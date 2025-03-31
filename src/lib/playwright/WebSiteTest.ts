import { chromium, Browser, Page, BrowserContext, ElementHandle } from 'playwright';
import { CustomStepResult, LLMDecision, PageElement, PageState, TestWebsiteRequest, TestWebsiteResponse, TestError, TestStep } from '../types';
import { generateTestId } from '../utils';
import { TestDataGenerator } from './TestDataGenerator';
import { BaseLLMService } from '../services/BaseLLMService';
import { OpenAIService } from '../services/OpenAIService';
import { PlaywrightDOMInteractor } from '../interactions/PlaywrightDOMInteractor';
import { InteractableElement } from '../interactions/BaseDOMInteractor';

export class WebSiteTest {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private pages: Map<string, Page> = new Map(); // Track all pages/tabs
  private activePage: Page | null = null; // Currently active page
  private domInteractor: PlaywrightDOMInteractor | null = null;
  private testId: string;
  private steps: TestStep[] = [];
  private errors: TestError[] = [];
  private startTime: number = 0;
  private url: string = '';
  private options = {
    timeout: 300000,
    screenshotCapture: true
  };
  private llmService: BaseLLMService | null = null;
  private customStepsResults: CustomStepResult[] = [];

  constructor(request: TestWebsiteRequest) {
    this.testId = generateTestId();
    this.url = request.url;
    
    if (request.options) {
      this.options = {
        ...this.options,
        ...request.options
      };
    }
    
    // Initialize LLM service if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.llmService = new OpenAIService(apiKey);
    }
  }

  /**
   * Initialize the browser and context
   */
  async initialize(): Promise<void> {
    try {
      this.startTime = Date.now();
      this.browser = await chromium.launch({
        headless: true,
      });
      
      // Configure browser context to listen for new page events
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'RevylBot/1.0 (+https://revyl.io/bot)'
      });
      
      // Set up listener for new pages (tabs) being created
      this.context.on('page', async (page) => {
        // Store the new page with a unique identifier
        const pageId = `page_${this.pages.size + 1}`;
        this.pages.set(pageId, page);
        this.activePage = page;
        
        // Set up domInteractor for the new active page
        this.domInteractor = new PlaywrightDOMInteractor(page);
        
        // Handle page close events
        page.on('close', () => {
          // Remove the page from our collection
          for (const [id, p] of this.pages.entries()) {
            if (p === page) {
              this.pages.delete(id);
              break;
            }
          }
          
          // If this was the active page, switch to another page if available
          if (this.activePage === page && this.pages.size > 0) {
            const newActivePage = Array.from(this.pages.values())[0];
            this.activePage = newActivePage;
            this.domInteractor = new PlaywrightDOMInteractor(newActivePage);
          }
        });
      });
      
      // Create initial page
      this.page = await this.context.newPage();
      this.pages.set('page_0', this.page);
      this.activePage = this.page;
      
      // Initialize DOM interactor for the initial page
      this.domInteractor = new PlaywrightDOMInteractor(this.page);
    } catch (error) {
      this.addError('initialization', 'Failed to initialize browser', error);
      throw error;
    }
  }
  
  /**
   * Run test with custom steps guided by LLM
   */
  async runTestWithCustomSteps(url: string, customSteps: string[]): Promise<TestWebsiteResponse> {
    try {
      await this.initialize();
      
      // Step 1: Navigate to page
      await this.navigateToPage(url);
      
      // Execute custom steps if LLM service is available
      if (this.llmService) {
        for (const step of customSteps) {
          const stepResult = await this.executeCustomStep(step);
          this.customStepsResults.push(stepResult);
          
          // Stop execution if a step fails
          if (!stepResult.success) {
            break;
          }
        }
      } else {
        // Fall back to standard test if LLM service is not available
        this.addError('custom_steps', 'LLM service not available', 
          'The OpenAI API key is not configured. Falling back to standard test.');
      }
      
      // Determine success based on custom steps execution
      const allStepsSucceeded = this.customStepsResults.every(step => step.success);
      
      // Check if we found a CTA element and completed a form in the custom steps
      const ctaFound = this.customStepsResults.some(step => 
        step.instruction.toLowerCase().includes('click') || 
        step.instruction.toLowerCase().includes('button'));
      
      const formSubmitted = this.customStepsResults.some(step => 
        step.instruction.toLowerCase().includes('submit') || 
        step.instruction.toLowerCase().includes('form'));
      
      return this.generateResponseWithCustomSteps(ctaFound, formSubmitted);
    } catch (error) {
      this.addError('custom_step_execution', 'Custom step execution failed', error);
      return this.generateResponseWithCustomSteps(false, false);
    } finally {
      await this.cleanup();
    }
  }
  
  /**
   * Execute a single custom step using LLM guidance
   */
  private async executeCustomStep(instruction: string): Promise<CustomStepResult> {
    try {
      // Initialize the step state
      const previousActions: LLMDecision[] = [];
      let isStepComplete = false;
      let finalSuccess = false;
      let finalError: string | undefined = undefined;
      let finalScreenshot = '';
      let finalDecision: LLMDecision | undefined = undefined;
      
      // Continue executing actions until the LLM indicates the step is complete
      while (!isStepComplete) {
        // Extract page state for LLM context
        const pageState = await this.extractPageState();
        
        // Determine the action to take using LLM
        const decision = await this.llmService!.determineNextAction(
          pageState,
          instruction,
          previousActions
        );
        
        // Store this decision for the feedback loop
        previousActions.push(decision);
        finalDecision = decision;
        
        // Convert PageElement to InteractableElement if needed
        const targetElement = decision.targetElement ? this.convertToInteractableElement(decision.targetElement) : undefined;
        
        // Execute the action based on LLM decision using the DOM interactor
        let actionSuccess = false;
        let actionError = undefined;
        
        try {
          if (!this.domInteractor) {
            throw new Error('DOM interactor not initialized');
          }
          
          // Handle tab switching if needed
          if (decision.action === 'switchTab' && decision.value) {
            const tabId = decision.value;
            if (this.pages.has(tabId)) {
              this.activePage = this.pages.get(tabId)!;
              this.domInteractor = new PlaywrightDOMInteractor(this.activePage);
              actionSuccess = true;
            } else {
              actionError = `Tab with ID ${tabId} not found`;
            }
          } else {
            switch (decision.action) {
              case 'click':
                if (targetElement) {
                  actionSuccess = await this.domInteractor.click(targetElement);
                  
                  // After a click, check if a new page was created (might be a new tab)
                  // New pages are automatically handled by the 'page' event on context
                  // This case handles clicks that might navigate or open new tabs
                  if (actionSuccess) {
                    // Give time for a potential new tab to open
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                } else {
                  actionError = 'No target element provided for click action';
                }
                break;
                
              case 'type':
                if (targetElement && decision.value) {
                  actionSuccess = await this.domInteractor.fill(targetElement, decision.value);
                } else {
                  actionError = 'Target element or value missing for type action';
                }
                break;
                
              case 'select':
                if (targetElement && decision.value) {
                  actionSuccess = await this.domInteractor.select(targetElement, decision.value);
                } else {
                  actionError = 'Target element or value missing for select action';
                }
                break;
                
              case 'submit':
                if (targetElement) {
                  actionSuccess = await this.domInteractor.submitForm(targetElement);
                } else {
                  actionSuccess = await this.domInteractor.submitForm();
                }
                break;
                
              case 'wait':
                if (targetElement) {
                  actionSuccess = await this.domInteractor.waitForElement(targetElement);
                } else {
                  // General wait
                  await this.activePage!.waitForTimeout(2000);
                  actionSuccess = true;
                }
                break;
                
              case 'verify':
                if (targetElement) {
                  actionSuccess = await this.domInteractor.exists(targetElement);
                } else {
                  actionError = 'No target element provided for verify action';
                }
                
                // Special case: verify can be used to check if the step is complete
                if (actionSuccess && decision.reasoning.toLowerCase().includes('complete') ||
                    decision.reasoning.toLowerCase().includes('finish') ||
                    decision.reasoning.toLowerCase().includes('success') ||
                    decision.reasoning.toLowerCase().includes('done')) {
                  isStepComplete = true;
                  finalSuccess = true;
                }
                break;
                
              case 'hover':
                if (targetElement) {
                  actionSuccess = await this.domInteractor.hover(targetElement);
                } else {
                  actionError = 'No target element provided for hover action';
                }
                break;
                
              case 'check':
                if (targetElement) {
                  const state = decision.value === 'false' ? false : true;
                  actionSuccess = await this.domInteractor.check(targetElement, state);
                } else {
                  actionError = 'No target element provided for check action';
                }
                break;
                
              case 'press':
                if (decision.value) {
                  actionSuccess = await this.domInteractor.pressKey(decision.value);
                } else {
                  actionError = 'No key provided for press action';
                }
                break;
                
              default:
                actionError = `Unsupported action: ${decision.action}`;
            }
          }
          
          // Check if the LLM explicitly indicates the step is complete
          if (decision.isComplete) {
            isStepComplete = true;
            finalSuccess = actionSuccess;
          }
          
          // Check if the reasoning indicates step completion
          else if (decision.reasoning && (
              decision.reasoning.toLowerCase().includes('step complete') ||
              decision.reasoning.toLowerCase().includes('goal complete') ||
              decision.reasoning.toLowerCase().includes('task complete') ||
              decision.reasoning.toLowerCase().includes('form submitted') ||
              decision.reasoning.toLowerCase().includes('form completed') ||
              (decision.action === 'submit' && actionSuccess))) {
            isStepComplete = true;
            finalSuccess = actionSuccess;
          }
          
          // If the action failed, mark step as complete but failed
          if (!actionSuccess) {
            finalError = actionError;
            // If action failed multiple times with the same target, consider the step failed and exit
            const similarFailedActions = previousActions.filter(a => 
              !a.targetElement ? false : 
              a.targetElement.id === decision.targetElement?.id && 
              a.action === decision.action && 
              !actionSuccess
            );
            
            if (similarFailedActions.length >= 2) {
              isStepComplete = true;
              finalSuccess = false;
            }
          }
          
          // If we've tried too many actions, consider the step failed
          if (previousActions.length >= 10) {
            isStepComplete = true;
            finalSuccess = false;
            finalError = finalError || 'Too many actions attempted without completing the step';
          }
          
          // Capture screenshot
          finalScreenshot = await this.domInteractor.takeScreenshot() || '';
          
        } catch (e) {
          actionError = e instanceof Error ? e.message : String(e);
          actionSuccess = false;
          
          // If exception occurred, still add to previous actions to inform LLM
          previousActions[previousActions.length - 1] = {
            ...previousActions[previousActions.length - 1],
            reasoning: `${previousActions[previousActions.length - 1].reasoning} (Error: ${actionError})`
          };
          
          // If we've had multiple consecutive errors, exit the loop
          const consecutiveErrors = previousActions.slice(-3).every(a => 
            a.reasoning.includes('Error:')
          );
          
          if (consecutiveErrors) {
            isStepComplete = true;
            finalSuccess = false;
            finalError = actionError;
          }
        }
        
        // Add a short delay between actions to avoid overwhelming the page
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Return the final result
      return {
        instruction,
        success: finalSuccess,
        error: finalError,
        screenshot: finalScreenshot,
        llmDecision: finalDecision,
        status: finalSuccess ? "success" : "failure"
      };
    } catch (error) {
      return {
        instruction,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        status: "failure"
      };
    }
  }
  
  /**
   * Convert PageElement to InteractableElement
   */
  private convertToInteractableElement(element: PageElement): InteractableElement {
    const attributes: Record<string, string | undefined> = {};
    
    if (element.type) attributes['type'] = element.type;
    if (element.placeholder) attributes['placeholder'] = element.placeholder;
    if (element.name) attributes['name'] = element.name;
    if (element.href) attributes['href'] = element.href;
    
    return {
      tag: element.tag,
      id: element.id,
      classes: element.classes,
      text: element.text,
      attributes,
      rect: element.rect
    };
  }
  
  /**
   * Extract page state for LLM context
   */
  private async extractPageState(): Promise<PageState> {
    if (!this.domInteractor) {
      throw new Error('DOM interactor not initialized');
    }
    
    const screenshot = await this.domInteractor.takeScreenshot();
    const interactableElements = await this.domInteractor.getInteractableElements();
    
    // Convert InteractableElement[] to PageElement[]
    const pageElements = interactableElements.map(el => ({
      tag: el.tag || '',
      type: el.attributes?.type,
      id: el.id,
      classes: el.classes || [],
      text: el.text || '',
      placeholder: el.attributes?.placeholder,
      name: el.attributes?.name,
      href: el.attributes?.href,
      rect: el.rect || { x: 0, y: 0, width: 0, height: 0 },
      visible: true
    }));
    
    return {
      title: await this.domInteractor.getPageTitle(),
      url: await this.domInteractor.getPageUrl(),
      screenshot,
      elements: pageElements,
      timestamp: new Date().toISOString(),
      availableTabs: Array.from(this.pages.keys())
    };
  }

  /**
   * Navigate to the target page
   */
  private async navigateToPage(url: string): Promise<void> {
    try {
      this.addStep('page_navigation', 'running');
      
      if (!this.domInteractor) {
        throw new Error('DOM interactor not initialized');
      }
      
      const success = await this.domInteractor.navigate(url, { 
        timeout: this.options.timeout,
        waitUntil: 'networkidle'
      });
      
      if (!success) {
        throw new Error('Navigation failed');
      }
      
      await this.captureScreenshot('page_navigation');
      this.updateStepStatus('page_navigation', 'success');
    } catch (error) {
      this.updateStepStatus('page_navigation', 'failure');
      this.addError('page_navigation', 'Failed to navigate to page', error);
      throw error;
    }
  }
  
  /**
   * Capture a screenshot if enabled
   */
  private async captureScreenshot(stepName: string): Promise<void> {
    if (!this.options.screenshotCapture || !this.domInteractor) return;
    
    try {
      const screenshot = await this.domInteractor.takeScreenshot();
      
      // Find the step and add the screenshot
      const step = this.steps.find(s => s.name === stepName);
      if (step) {
        step.screenshot = screenshot;
      }
    } catch (error) {
      // Just log the error and continue - screenshots are non-critical
      console.error(`Failed to capture screenshot for step ${stepName}:`, error);
    }
  }

  /**
   * Add a new test step
   */
  private addStep(name: string, status: 'running' | 'success' | 'failure'): void {
    this.steps.push({
      name,
      status,
      duration: 0
    });
  }

  /**
   * Update the status of a step
   */
  private updateStepStatus(name: string, status: 'success' | 'failure'): void {
    const step = this.steps.find(s => s.name === name);
    if (step) {
      step.status = status;
      step.duration = Date.now() - this.startTime;
    }
  }

  /**
   * Add an error
   */
  private addError(step: string, message: string, error: unknown): void {
    let details = '';
    
    if (error instanceof Error) {
      details = error.stack || error.message;
    } else if (typeof error === 'string') {
      details = error;
    } else {
      details = JSON.stringify(error);
    }
    
    this.errors.push({
      step,
      message,
      details
    });
  }

  /**
   * Generate response with custom steps
   */
  private generateResponseWithCustomSteps(ctaFound: boolean, formSubmitted: boolean): TestWebsiteResponse {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    return {
      success: this.customStepsResults.every(step => step.success),
      testId: this.testId,
      url: this.url,
      primaryCTAFound: ctaFound,
      interactionSuccessful: formSubmitted,
      steps: this.steps,
      customStepsResults: this.customStepsResults,
      totalDuration,
      errors: this.errors
    };
  }

  /**
   * Generate the test response
   */
  private generateResponse(ctaFound: boolean, formSubmitted: boolean): TestWebsiteResponse {
    const totalDuration = Date.now() - this.startTime;
    
    return {
      success: ctaFound && formSubmitted,
      testId: this.testId,
      url: this.url,
      primaryCTAFound: ctaFound,
      interactionSuccessful: formSubmitted,
      steps: this.steps,
      totalDuration,
      errors: this.errors
    };
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    try {
      this.pages.clear();
      this.activePage = null;
      this.page = null;
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
} 