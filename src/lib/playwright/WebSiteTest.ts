import { chromium, Browser, Page, BrowserContext, ElementHandle } from 'playwright';
import { CustomStepResult, LLMDecision, PageElement, PageState, TestWebsiteRequest, TestWebsiteResponse, TestError, TestStep } from '../types';
import { generateTestId } from '../utils';
import { TestDataGenerator } from './TestDataGenerator';
import { BaseLLMService } from '../services/BaseLLMService';
import { OpenAIService } from '../services/OpenAIService';
import { PlaywrightDOMInteractor } from '../interactions/PlaywrightDOMInteractor';
import { InteractableElement } from '../interactions/BaseDOMInteractor';
import { parseLLMFeedback } from '../utils';

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
    screenshotCapture: true,
    headless: true
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
        headless: this.options.headless !== false, // Allow disabling headless mode
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
        
        console.log(`New page detected and added with ID: ${pageId}, URL: ${page.url()}`);
        
        // Automatically switch to the new page/tab
        this.activePage = page;
        
        // Set up domInteractor for the new active page
        this.domInteractor = new PlaywrightDOMInteractor(page);
        
        // Handle page close events
        page.on('close', () => {
          // Remove the page from our collection
          for (const [id, p] of this.pages.entries()) {
            if (p === page) {
              console.log(`Page closed: ${id}, URL: ${page.url()}`);
              this.pages.delete(id);
              break;
            }
          }
          
          // If this was the active page, switch to another page if available
          if (this.activePage === page && this.pages.size > 0) {
            const newActivePage = Array.from(this.pages.values())[0];
            this.activePage = newActivePage;
            this.domInteractor = new PlaywrightDOMInteractor(newActivePage);
            console.log(`Switched to available page: ${this.activePage.url()}`);
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
        for (let i = 0; i < customSteps.length; i++) {
          const step = customSteps[i];
          
          // For the first step, try a more robust approach regardless of button type
          // This helps with any click-related first step
          if (i === 0 && step.toLowerCase().includes('click')) {
            console.log("Enhanced handling for first interaction step");
            try {
              // Extract the target text from the instruction (if any)
              const clickTextMatch = step.match(/click(?:\s+on)?(?:\s+the)?\s+"?([^"]+)"?/i);
              const targetText = clickTextMatch ? clickTextMatch[1].trim() : '';
              
              // Try direct methods first for generic button clicking
              if (await this.tryGenericButtonClick(targetText)) {
                console.log("Generic click approach worked for first step");
                // Create a success result
                const successResult: CustomStepResult = {
                  instruction: step,
                  success: true,
                  status: "success",
                  llmFeedback: `PASS: Successfully clicked using enhanced button detection.`,
                  screenshot: await this.domInteractor?.takeScreenshot() || ''
                };
                
                this.customStepsResults.push(successResult);
                continue; // Skip to the next step
              }
              
              console.log("Enhanced generic click approach failed, falling back to standard LLM-guided approach");
            } catch (error) {
              console.log("Enhanced button click handling failed:", error);
              // Continue with standard approach
            }
          }
          
          // Standard execution approach for all other steps
          const stepResult = await this.executeCustomStep(step);
          this.customStepsResults.push(stepResult);
          
          // Continue execution even if a step fails (removed break statement)
          // Log the failure but proceed to the next step
          if (!stepResult.success) {
            console.log(`Step "${step}" failed but continuing with remaining steps as requested.`);
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
   * Generic method to try various approaches to click a button
   * Works with any button type, not specific to any particular button text
   */
  private async tryGenericButtonClick(targetText: string = ''): Promise<boolean> {
    if (!this.activePage) return false;
    
    console.log(`Attempting generic button click${targetText ? ` for "${targetText}"` : ''}`);
    
    // Create a set of generic selectors based on the target text if provided
    const buttonSelectors: string[] = [];
    
    if (targetText) {
      // Add text-based selectors - case insensitive and various forms
      buttonSelectors.push(
        `text="${targetText}"`,
        `:text("${targetText}")`,
        `:text-matches("${targetText}", "i")`,
        `a:has-text("${targetText}")`,
        `button:has-text("${targetText}")`,
        `[role="button"]:has-text("${targetText}")`,
        `xpath=//a[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "${targetText.toLowerCase()}")]`,
        `xpath=//button[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "${targetText.toLowerCase()}")]`,
        `xpath=//*[contains(translate(text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"), "${targetText.toLowerCase()}")]`
      );
    }
    
    // Add generic button selectors that work regardless of text
    buttonSelectors.push(
      'a.button', 
      'a.btn',
      'button.primary',
      'button[type="submit"]',
      '[role="button"]',
      '.cta',
      '.call-to-action'
    );
    
    // Try each selector in sequence
    for (const selector of buttonSelectors) {
      try {
        console.log(`Trying generic click with selector: ${selector}`);
        
        // Check if the selector finds any elements
        const element = await this.activePage.$(selector);
        if (element) {
          console.log(`Found element with selector: ${selector}, attempting click`);
          
          // Try to click with force: true to bypass any overlay issues
          await this.activePage.click(selector, { force: true, timeout: 3000 });
          
          // Wait to see if anything changes
          await this.activePage.waitForTimeout(2000);
          
          // Check if new tabs were created
          await this.checkAndSwitchToNewTab();
          
          console.log("Direct click succeeded");
          return true;
        }
      } catch (clickError) {
        console.log(`Click with selector ${selector} failed:`, clickError);
      }
    }
    
    // If direct selectors failed, try using JavaScript to find and click buttons
    try {
      // Log all clickable elements for debugging
      const allButtons = await this.activePage.$$eval(
        'a, button, [role="button"], .button, [type="button"], [class*="btn"], [class*="button"]',
        (elements, targetButtonText) => elements
          .filter(e => {
            // If targetText is provided, filter elements containing that text
            if (targetButtonText) {
              return e.textContent?.toLowerCase().includes(targetButtonText.toLowerCase());
            }
            // Otherwise, look for prominent buttons
            const rect = e.getBoundingClientRect();
            const styles = window.getComputedStyle(e);
            // Filter visible elements that look like buttons
            return rect.width > 0 && 
                  rect.height > 0 && 
                  styles.display !== 'none' && 
                  styles.visibility !== 'hidden';
          })
          .map(e => ({
            text: e.textContent?.trim() || '',
            tag: e.tagName.toLowerCase(),
            href: e.hasAttribute('href') ? e.getAttribute('href') : null,
            classes: Array.from(e.classList).join(' '),
            rect: e.getBoundingClientRect()
          })),
        targetText
      );
      
      console.log(`Found ${allButtons.length} potential clickable elements${targetText ? ` matching "${targetText}"` : ''}`);
      
      if (allButtons.length > 0) {
        // Try clicking each candidate, starting with the most likely ones
        // Sort by prominence (size and position)
        const sortedButtons = [...allButtons].sort((a, b) => {
          // Prefer elements with targetText if provided
          if (targetText) {
            const aHasText = a.text.toLowerCase().includes(targetText.toLowerCase());
            const bHasText = b.text.toLowerCase().includes(targetText.toLowerCase());
            if (aHasText && !bHasText) return -1;
            if (!aHasText && bHasText) return 1;
          }
          
          // Then sort by size (bigger buttons are usually more important)
          const aSize = a.rect.width * a.rect.height;
          const bSize = b.rect.width * b.rect.height;
          return bSize - aSize;
        });
        
        for (let i = 0; i < Math.min(sortedButtons.length, 5); i++) {
          const btn = sortedButtons[i];
          try {
            console.log(`Attempting to click candidate #${i+1}: ${btn.text} (${btn.tag})`);
            
            // Try to create a selector that will find this exact element
            let targetSelector = '';
            
            // Try different selector strategies
            if (btn.text) {
              targetSelector = `:text("${btn.text}")`;
            } else if (btn.href) {
              targetSelector = `${btn.tag}[href="${btn.href}"]`;
            } else if (btn.classes) {
              targetSelector = `${btn.tag}.${btn.classes.split(' ')[0]}`;
            } else {
              // Skip if we can't create a good selector
              continue;
            }
            
            console.log(`Using selector: ${targetSelector}`);
            await this.activePage.click(targetSelector, { force: true, timeout: 3000 });
            console.log(`Successfully clicked element using JavaScript detection`);
            
            // Wait to see if anything changes
            await this.activePage.waitForTimeout(2000);
            await this.checkAndSwitchToNewTab();
            
            return true;
          } catch (buttonError) {
            console.log(`Failed to click candidate #${i+1}:`, buttonError);
          }
        }
      }
    } catch (jsError) {
      console.log("JavaScript button detection failed:", jsError);
    }
    
    return false;
  }

  /**
   * Check for new tabs and switch to the most recent one if needed
   * This is helpful when a click action opens a new tab
   */
  private async checkAndSwitchToNewTab(): Promise<boolean> {
    if (!this.context) return false;
    
    // Get all current browser pages
    const contextPages = this.context.pages();
    console.log(`Total pages in browser context: ${contextPages.length}`);
    
    // Track currently known page URLs
    const trackedPageUrls = new Map<string, string>();
    for (const [id, page] of this.pages.entries()) {
      trackedPageUrls.set(id, page.url());
    }
    
    // Log the current tracked pages
    console.log(`Currently tracked pages: ${Array.from(trackedPageUrls.entries())
      .map(([id, url]) => `${id}=${url}`)
      .join(', ')}`);
    
    // Find any pages that aren't in our tracked pages collection
    let newPageFound = false;
    for (const contextPage of contextPages) {
      const contextPageUrl = contextPage.url();
      let isTracked = false;
      let matchingId = '';
      
      for (const [id, trackedPage] of this.pages.entries()) {
        if (contextPage === trackedPage) {
          isTracked = true;
          matchingId = id;
          break;
        }
      }
      
      if (isTracked) {
        console.log(`Page already tracked: ${matchingId} (${contextPageUrl})`);
      } else {
        console.log(`Found untracked page with URL: ${contextPageUrl}`);
      }
      
      // If we found a page that isn't tracked, add it and switch to it
      if (!isTracked) {
        const pageId = `page_${this.pages.size + 1}`;
        this.pages.set(pageId, contextPage);
        this.activePage = contextPage;
        this.domInteractor = new PlaywrightDOMInteractor(contextPage);
        
        // Wait for the page to load
        try {
          await contextPage.waitForLoadState('domcontentloaded', { timeout: 5000 });
        } catch (error) {
          console.log(`Warning: Timeout waiting for new page to load fully: ${error}`);
        }
        
        console.log(`Found and switched to new tab (ID: ${pageId}): ${contextPageUrl}`);
        newPageFound = true;
      }
    }
    
    // If we have multiple pages but no new ones were found, make sure we're on the latest one
    if (!newPageFound && contextPages.length > 1) {
      // Find the newest page (typically the last one in the array)
      let latestPage = contextPages[contextPages.length - 1];
      
      // First check for any 'untitled' pages which are likely new tabs still loading
      const untitledPage = contextPages.find(page => 
        page.url() === 'about:blank' || 
        page.url() === '' || 
        page.url().includes('new-tab')
      );
      
      if (untitledPage) {
        latestPage = untitledPage;
        console.log(`Found untitled/blank page which is likely new: ${untitledPage.url()}`);
      }
      
      // If the active page is not the latest one, switch to it
      if (this.activePage !== latestPage) {
        this.activePage = latestPage;
        this.domInteractor = new PlaywrightDOMInteractor(latestPage);
        
        // Find the ID for logging
        let pageId = "unknown";
        for (const [id, page] of this.pages.entries()) {
          if (page === latestPage) {
            pageId = id;
            break;
          }
        }
        
        console.log(`Switched to most recent tab (ID: ${pageId}): ${latestPage.url()}`);
        return true;
      }
    }
    
    return newPageFound;
  }

  /**
   * Execute a single custom step using LLM guidance
   */
  private async executeCustomStep(instruction: string): Promise<CustomStepResult> {
    try {
      // Variables to track execution
      let isStepComplete = false;
      let finalSuccess = false;
      let finalError: string | undefined = undefined;
      let finalScreenshot: string | undefined = undefined;
      let finalDecision: any = null;
      let llmFeedback: string | undefined = undefined;
      
      // Initialize the step state
      const previousActions: LLMDecision[] = [];
      let maxAttempts = 3; // Allow more attempts for a single step
      
      // Continue executing actions until the LLM indicates the step is complete
      while (!isStepComplete && previousActions.length < maxAttempts) {
        // First, check if we need to switch to a new tab that might have been created
        await this.checkAndSwitchToNewTab();
        
        // Extract page state for LLM context
        const pageState = await this.extractPageState();
        
        // Log current tab information
        console.log(`Current active tab: ${this.activePage?.url()}`);
        console.log(`Available tabs: ${Array.from(this.pages.keys()).join(', ')}`);
        
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
        
        // Log decision details for debugging
        console.log(`LLM Decision: ${decision.action}${targetElement ? ` on element "${targetElement.text || 'unnamed'}"` : ''}${decision.value ? ` with value "${decision.value}"` : ''}`);
        console.log(`Confidence: ${decision.confidence}%, Reasoning: ${decision.reasoning}`);
        
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
              console.log(`Switched to tab: ${tabId}, URL: ${this.activePage.url()}`);
              actionSuccess = true;
            } else {
              actionError = `Tab with ID ${tabId} not found`;
            }
          } else {
            switch (decision.action) {
              case 'click':
                if (targetElement) {
                  // For important clicks, add more logging
                  console.log(`Attempting to click element: ${JSON.stringify({
                    tag: targetElement.tag, 
                    text: targetElement.text,
                    classes: targetElement.classes
                  })}`);
                  
                  // Perform the click
                  actionSuccess = await this.domInteractor.click(targetElement);
                  
                  // After a click, check if a new tab was created
                  await this.checkAndSwitchToNewTab();
                  
                  // After a click, allow more time for page changes to complete
                  if (actionSuccess) {
                    // Wait for navigation or DOM changes to complete
                    try {
                      // Wait for network idle or any navigation
                      await this.activePage!.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {
                        // If timeout, it's okay - page might not navigate
                        console.log('Network idle wait timed out, continuing...');
                      });
                      
                      // Additional wait to ensure DOM is stable
                      await this.activePage!.waitForTimeout(1000);
                      
                      // Check again for new tabs - some might appear after network idle
                      await this.checkAndSwitchToNewTab();
                    } catch (error) {
                      console.log('Wait after click failed, continuing anyway:', error);
                    }
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
                
                // After form submission, wait for page to stabilize
                try {
                  await this.activePage!.waitForLoadState('networkidle', { timeout: 5000 });
                  await this.activePage!.waitForTimeout(1000);
                } catch (error) {
                  console.log('Wait after form submission failed, continuing anyway:', error);
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
                if (actionSuccess && (
                    decision.reasoning.toLowerCase().includes('complete') ||
                    decision.reasoning.toLowerCase().includes('finish') ||
                    decision.reasoning.toLowerCase().includes('success') ||
                    decision.reasoning.toLowerCase().includes('done'))) {
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
          
          // Log action success or failure
          if (actionSuccess) {
            console.log(`Action ${decision.action} succeeded`);
          } else {
            console.log(`Action ${decision.action} failed: ${actionError || 'Unknown error'}`);
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
          
          // If the action failed, provide detailed error
          if (!actionSuccess) {
            finalError = actionError ? actionError : 
              `Failed to perform ${decision.action} on ${targetElement ? 
              `${targetElement.tag} element with text "${targetElement.text || ''}"` : 
              'element (no target found)'}`;
            
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
              finalError = `FAIL: ${finalError}. Attempted ${similarFailedActions.length} times with the same element.`;
            }
          }
          
          // If we've reached max attempts, consider the step failed
          if (previousActions.length >= maxAttempts) {
            isStepComplete = true;
            finalSuccess = false;
            finalError = finalError || `FAIL: Maximum number of attempts (${maxAttempts}) reached without completing the step.`;
          }
          
          // Capture screenshot
          finalScreenshot = await this.domInteractor.takeScreenshot() || '';
          
          // After each action, get feedback from the LLM about the current state
          if (this.llmService && finalScreenshot) {
            try {
              // Get updated page state after the action
              const updatedPageState = await this.extractPageState();
              
              // Get LLM feedback on the result of the action
              const feedback = await this.llmService.validateActionResult(
                updatedPageState,
                instruction,
                decision,
                actionSuccess
              );
              
              // Store the feedback
              llmFeedback = feedback.feedback;
              
              // If the LLM indicates the step is complete based on the visual feedback
              if (feedback.isComplete) {
                isStepComplete = true;
                finalSuccess = feedback.isSuccess;
                
                // If the step failed, enhance the feedback
                if (!feedback.isSuccess) {
                  llmFeedback = feedback.feedback || `FAIL: The ${decision.action} action on the element was unsuccessful.`;
                } else {
                  llmFeedback = feedback.feedback || `PASS: The ${decision.action} action on the element was successful.`;
                }
              }
            } catch (error) {
              console.error('Error getting LLM feedback:', error);
              llmFeedback = actionSuccess ? 
                `PASS: Action performed successfully but couldn't get detailed feedback.` : 
                `FAIL: Action failed. ${finalError || "Element might not be visible or interactive."}`;
            }
          }
          
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
            finalError = `FAIL: ${actionError}. Multiple consecutive errors occurred.`;
          }
        }
        
        // Add a short delay between actions to avoid overwhelming the page
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // If no LLM feedback available but we have an error, create default feedback
      if (!llmFeedback && finalError) {
        llmFeedback = finalError.startsWith('FAIL:') ? finalError : `FAIL: ${finalError}`;
      } else if (!llmFeedback && finalSuccess) {
        llmFeedback = `PASS: Successfully completed the step "${instruction}".`;
      }
      
      // Parse the LLM feedback
      const parsedLLMFeedback = parseLLMFeedback(llmFeedback);
      
      // Update success status based on parsed feedback if available
      if (parsedLLMFeedback) {
        finalSuccess = parsedLLMFeedback.status === 'PASS';
      }
      
      return {
        instruction,
        success: finalSuccess,
        screenshot: finalScreenshot,
        llmDecision: finalDecision,
        error: finalError,
        status: finalSuccess ? "success" : "failure",
        llmFeedback,
        parsedLLMFeedback
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const llmFeedback = `FAIL: An unexpected error occurred: ${errorMsg}`;
      
      return {
        instruction,
        success: false,
        error: errorMsg,
        status: "failure",
        llmFeedback,
        parsedLLMFeedback: parseLLMFeedback(llmFeedback)
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
    
    // Add a small delay to ensure page has updated before capturing state
    await this.activePage!.waitForTimeout(500);
    
    // Capture screenshot with higher quality
    const screenshot = await this.domInteractor.takeScreenshot();
    if (!screenshot || screenshot.trim() === '') {
      console.warn("Failed to capture screenshot or screenshot is empty");
    } else {
      const screenshotSize = Math.round((screenshot.length * 3) / 4); // Approximate base64 size
      console.log(`Captured screenshot: ~${Math.round(screenshotSize/1024)}KB`);
    }
    
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
        
        // Get LLM feedback if LLM service is available
        if (this.llmService && step.status === "success") {
          try {
            // Get updated page state
            const pageState = await this.extractPageState();
            
            // Get LLM feedback on the result of the step
            const feedback = await this.llmService.validateActionResult(
              pageState,
              `Execute step "${stepName}"`,
              { 
                action: "click", // Use a valid action type
                confidence: 100, 
                reasoning: `Executing standard step "${stepName}"`, 
                isComplete: true 
              },
              true
            );
            
            // Store the feedback
            step.llmFeedback = feedback.feedback;
          } catch (error) {
            console.error(`Failed to get LLM feedback for step ${stepName}:`, error);
          }
        }
      }
    } catch (error) {
      // Just log the error and continue - screenshots are non-critical
      console.error(`Failed to capture screenshot for step ${stepName}:`, error);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close().catch(err => {
          console.warn('Error closing browser:', err.message);
        });
      }
      
      if (this.context) {
        await this.context.close().catch(err => {
          console.warn('Error closing browser context:', err.message);
        });
      }
    } catch (error) {
      console.warn('Error during cleanup:', error instanceof Error ? error.message : String(error));
    } finally {
      // Always reset instance variables regardless of cleanup success
      this.browser = null;
      this.context = null;
      this.page = null;
      this.pages.clear();
      this.activePage = null;
      this.domInteractor = null;
      this.steps = [];
      this.errors = [];
      this.startTime = 0;
      this.url = '';
      this.options = {
        timeout: 300000,
        screenshotCapture: true,
        headless: true
      };
      this.llmService = null;
      this.customStepsResults = [];
    }
  }

  /**
   * Process LLM feedback for all custom steps and standard steps
   * This will parse the raw feedback text and determine passed/failed status
   */
  private processLLMFeedbackForAllSteps(): void {
    // Process feedback for custom steps
    if (this.customStepsResults.length > 0) {
      this.customStepsResults = this.customStepsResults.map(step => {
        if (step.llmFeedback) {
          const parsedFeedback = parseLLMFeedback(step.llmFeedback);
          // Update success status based on parsed feedback
          if (parsedFeedback) {
            step.success = parsedFeedback.status === 'PASS';
            step.status = step.success ? 'success' : 'failure';
          }
          return {
            ...step,
            parsedLLMFeedback: parsedFeedback
          };
        }
        return step;
      });
    }
    
    // Process feedback for standard steps
    this.steps = this.steps.map(step => {
      if (step.llmFeedback) {
        const parsedFeedback = parseLLMFeedback(step.llmFeedback);
        // Update status based on parsed feedback
        if (parsedFeedback) {
          step.status = parsedFeedback.status === 'PASS' ? 'success' : 'failure';
        }
        return {
          ...step,
          parsedLLMFeedback: parsedFeedback
        };
      }
      return step;
    });
  }

  /**
   * Generate final test response with custom steps
   */
  private generateResponseWithCustomSteps(ctaFound: boolean, formSubmitted: boolean): TestWebsiteResponse {
    // Process LLM feedback before generating response
    this.processLLMFeedbackForAllSteps();
    
    // Calculate pass/fail metrics including LLM feedback
    const totalTests = this.steps.length + (this.customStepsResults?.length || 0);
    const passedTests = this.steps.filter(s => s.status === 'success').length + 
                        (this.customStepsResults?.filter(s => s.status === 'success').length || 0);
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    const endTime = Date.now();
    return {
      success: this.errors.length === 0,
      testId: this.testId,
      url: this.url,
      primaryCTAFound: ctaFound,
      interactionSuccessful: formSubmitted,
      steps: this.steps,
      totalDuration: endTime - this.startTime,
      errors: this.errors,
      customStepsResults: this.customStepsResults,
      testMetrics: {
        totalTests,
        passedTests,
        failedTests,
        passRate
      }
    };
  }

  /**
   * Add a step to the test steps
   */
  private addStep(name: string, status: "success" | "failure" | "running"): void {
    const now = Date.now();
    this.steps.push({
      name,
      status,
      screenshot: '',
      llmFeedback: '',
      duration: 0,
      error: ''
    });
  }

  /**
   * Update a step status
   */
  private updateStepStatus(name: string, status: "success" | "failure" | "running"): void {
    const step = this.steps.find(s => s.name === name);
    if (step) {
      step.status = status;
      // Calculate duration if this is a terminal status
      if (status === "success" || status === "failure") {
        const stepIndex = this.steps.findIndex(s => s.name === name);
        if (stepIndex !== -1) {
          const startTime = this.startTime + stepIndex * 100; // Approximate if we don't have actual start time
          step.duration = Date.now() - startTime;
        }
      }
    }
  }

  /**
   * Add an error to the test errors
   */
  private addError(name: string, message: string, error: unknown): void {
    this.errors.push({
      step: name,
      message: message,
      details: error instanceof Error ? error.message : String(error)
    });
  }
}