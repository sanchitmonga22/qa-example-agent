import { chromium, Browser, Page, BrowserContext, ElementHandle } from 'playwright';
import { CustomStepResult, LLMDecision, PageElement, PageState, TestBookingFlowRequest, TestBookingFlowResponse, TestError, TestStep } from '../types';
import { generateTestId } from '../utils';
import { TestDataGenerator } from './TestDataGenerator';
import { BaseLLMService } from '../services/BaseLLMService';
import { OpenAIService } from '../services/OpenAIService';
import { PlaywrightDOMInteractor } from '../interactions/PlaywrightDOMInteractor';
import { InteractableElement } from '../interactions/BaseDOMInteractor';

export class BookingFlowTest {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private domInteractor: PlaywrightDOMInteractor | null = null;
  private testId: string;
  private steps: TestStep[] = [];
  private errors: TestError[] = [];
  private startTime: number = 0;
  private url: string = '';
  private options = {
    timeout: 30000,
    screenshotCapture: true
  };
  private llmService: BaseLLMService | null = null;
  private customStepsResults: CustomStepResult[] = [];

  constructor(request: TestBookingFlowRequest) {
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
      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'RevylBot/1.0 (+https://revyl.io/bot)'
      });
      this.page = await this.context.newPage();
      
      // Initialize DOM interactor
      this.domInteractor = new PlaywrightDOMInteractor(this.page);
    } catch (error) {
      this.addError('initialization', 'Failed to initialize browser', error);
      throw error;
    }
  }

  /**
   * Run the booking flow test
   */
  async runTest(url: string): Promise<TestBookingFlowResponse> {
    try {
      await this.initialize();
      
      // Step 1: Navigate to page
      await this.navigateToPage(url);
      
      // Step 2: Find and click on "Book a Demo" element
      const demoFlowFound = await this.findAndClickDemoFlow();
      
      // Step 3: Fill out the form if found
      let bookingSuccessful = false;
      if (demoFlowFound) {
        bookingSuccessful = await this.fillOutForm();
      }

      return this.generateResponse(demoFlowFound, bookingSuccessful);
    } catch (error) {
      this.addError('test_execution', 'Test execution failed', error);
      return this.generateResponse(false, false);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Run test with custom steps guided by LLM
   */
  async runTestWithCustomSteps(url: string, customSteps: string[]): Promise<TestBookingFlowResponse> {
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
        return this.runTest(url);
      }
      
      // Determine success based on custom steps execution
      const allStepsSucceeded = this.customStepsResults.every(step => step.success);
      
      // Check if we found a demo element and completed booking in the custom steps
      const demoFlowFound = this.customStepsResults.some(step => 
        step.instruction.toLowerCase().includes('demo') || 
        step.instruction.toLowerCase().includes('book'));
      
      const bookingSuccessful = this.customStepsResults.some(step => 
        step.instruction.toLowerCase().includes('submit') || 
        step.instruction.toLowerCase().includes('form'));
      
      return this.generateResponseWithCustomSteps(demoFlowFound, bookingSuccessful);
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
          
          switch (decision.action) {
            case 'click':
              if (targetElement) {
                actionSuccess = await this.domInteractor.click(targetElement);
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
                await this.page!.waitForTimeout(2000);
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
      timestamp: new Date().toISOString()
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
   * Find and click on demo flow element
   */
  private async findAndClickDemoFlow(): Promise<boolean> {
    try {
      this.addStep('find_demo_button', 'running');
      
      if (!this.domInteractor) {
        throw new Error('DOM interactor not initialized');
      }
      
      // List of possible demo button texts
      const demoTexts = [
        "Book a Demo",
        "Get a Demo",
        "Request Demo",
        "Schedule Demo",
        "Book Demo",
        "Get Demo"
      ];
      
      // Get all interactable elements
      const elements = await this.domInteractor.getInteractableElements();
      
      // Find elements that might be demo buttons
      const demoElements = elements.filter(el => {
        // Check text content
        if (el.text) {
          return demoTexts.some(text => 
            el.text!.toLowerCase().includes(text.toLowerCase()));
        }
        
        // Check for demo in href
        if (el.attributes?.href) {
          return el.attributes.href.toLowerCase().includes('demo') || 
                 el.attributes.href.toLowerCase().includes('book') ||
                 el.attributes.href.toLowerCase().includes('schedule');
        }
        
        return false;
      });
      
      if (demoElements.length === 0) {
        this.updateStepStatus('find_demo_button', 'failure');
        this.addError('find_demo_button', 'Could not find a demo button or link', 
          'None of the elements on the page match demo button criteria.');
        return false;
      }
      
      // Click the first matching element
      const success = await this.domInteractor.click(demoElements[0]);
      
      if (!success) {
        this.updateStepStatus('find_demo_button', 'failure');
        this.addError('find_demo_button', 'Failed to click demo button', 
          'Element was found but could not be clicked.');
        return false;
      }
      
      // Wait for navigation or form to appear
      try {
        // First try to wait for form
        const formWait = await this.domInteractor.waitForElement({
          tag: 'form'
        }, { timeout: 5000 });
        
        if (!formWait) {
          // If no form, wait for navigation
          await this.domInteractor.waitForNavigation();
        }
      } catch (error) {
        // It's okay if neither happens, the button might reveal a form in-page
      }
      
      await this.captureScreenshot('find_demo_button');
      this.updateStepStatus('find_demo_button', 'success');
      return true;
    } catch (error) {
      this.updateStepStatus('find_demo_button', 'failure');
      this.addError('find_demo_button', 'Error while finding or clicking demo button', error);
      return false;
    }
  }

  /**
   * Fill out and submit the form
   */
  private async fillOutForm(): Promise<boolean> {
    try {
      this.addStep('fill_form', 'running');
      
      if (!this.domInteractor) {
        throw new Error('DOM interactor not initialized');
      }
      
      // Check if there's a form
      const formExists = await this.domInteractor.exists({ tag: 'form' });
      if (!formExists) {
        this.updateStepStatus('fill_form', 'failure');
        this.addError('fill_form', 'Could not find a form', 'No form element was detected on the page.');
        return false;
      }
      
      // Get all interactable elements
      const elements = await this.domInteractor.getInteractableElements();
      
      // Filter for input fields
      const nameInputs = elements.filter(el => 
        el.tag === 'input' && 
        (el.attributes?.type === 'text') && 
        (el.attributes?.name?.toLowerCase().includes('name') || 
         el.attributes?.placeholder?.toLowerCase().includes('name') ||
         el.attributes?.['aria-label']?.toLowerCase().includes('name'))
      );
      
      const emailInputs = elements.filter(el => 
        el.tag === 'input' && 
        (el.attributes?.type === 'email' || 
         el.attributes?.name?.toLowerCase().includes('email') ||
         el.attributes?.placeholder?.toLowerCase().includes('email'))
      );
      
      const companyInputs = elements.filter(el => 
        el.tag === 'input' && 
        (el.attributes?.name?.toLowerCase().includes('company') || 
         el.attributes?.placeholder?.toLowerCase().includes('company') ||
         el.attributes?.['aria-label']?.toLowerCase().includes('company'))
      );
      
      // Generate test data
      const name = TestDataGenerator.generateName();
      const email = TestDataGenerator.generateEmail();
      const company = TestDataGenerator.generateCompanyName();
      const phone = TestDataGenerator.generatePhoneNumber();
      
      // Fill in the form fields
      if (nameInputs.length > 0) {
        await this.domInteractor.fill(nameInputs[0], name);
      }
      
      if (emailInputs.length > 0) {
        await this.domInteractor.fill(emailInputs[0], email);
      }
      
      if (companyInputs.length > 0) {
        await this.domInteractor.fill(companyInputs[0], company);
      }
      
      // Find and fill other common fields
      const phoneInputs = elements.filter(el => 
        el.tag === 'input' && 
        (el.attributes?.type === 'tel' || 
         el.attributes?.name?.toLowerCase().includes('phone') ||
         el.attributes?.placeholder?.toLowerCase().includes('phone'))
      );
      
      if (phoneInputs.length > 0) {
        await this.domInteractor.fill(phoneInputs[0], phone);
      }
      
      // Look for job title fields
      const titleInputs = elements.filter(el => 
        el.tag === 'input' && 
        (el.attributes?.name?.toLowerCase().includes('title') || 
         el.attributes?.name?.toLowerCase().includes('position') ||
         el.attributes?.placeholder?.toLowerCase().includes('title') ||
         el.attributes?.placeholder?.toLowerCase().includes('position'))
      );
      
      if (titleInputs.length > 0) {
        await this.domInteractor.fill(titleInputs[0], TestDataGenerator.generateJobTitle());
      }
      
      await this.captureScreenshot('fill_form');
      this.updateStepStatus('fill_form', 'success');
      
      // Submit the form
      this.addStep('submit_form', 'running');
      
      // Try to submit the form
      const success = await this.domInteractor.submitForm();
      
      if (!success) {
        this.updateStepStatus('submit_form', 'failure');
        this.addError('submit_form', 'Failed to submit the form', 'The form could not be submitted');
        return false;
      }
      
      // Wait for confirmation page or message
      try {
        await this.domInteractor.waitForElement({
          selector: '.success, .thank-you, [data-success], h1:has-text("Thank You")'
        }, { timeout: this.options.timeout });
      } catch (error) {
        // It's okay if this fails, not all forms have a success message
      }
      
      await this.captureScreenshot('submit_form');
      this.updateStepStatus('submit_form', 'success');
      return true;
    } catch (error) {
      this.updateStepStatus('fill_form', 'failure');
      this.addError('fill_form', 'Error while filling out the form', error);
      return false;
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
  private generateResponseWithCustomSteps(demoFlowFound: boolean, bookingSuccessful: boolean): TestBookingFlowResponse {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    return {
      success: this.customStepsResults.every(step => step.success),
      testId: this.testId,
      url: this.url,
      demoFlowFound,
      bookingSuccessful,
      steps: this.steps,
      customStepsResults: this.customStepsResults,
      totalDuration,
      errors: this.errors
    };
  }

  /**
   * Generate the test response
   */
  private generateResponse(demoFlowFound: boolean, bookingSuccessful: boolean): TestBookingFlowResponse {
    const totalDuration = Date.now() - this.startTime;
    
    return {
      success: demoFlowFound && bookingSuccessful,
      testId: this.testId,
      url: this.url,
      demoFlowFound,
      bookingSuccessful,
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
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
} 