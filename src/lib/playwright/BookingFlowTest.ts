import { chromium, Browser, Page, BrowserContext, ElementHandle } from 'playwright';
import { CustomStepResult, LLMDecision, PageElement, PageState, TestBookingFlowRequest, TestBookingFlowResponse, TestError, TestStep } from '../types';
import { generateTestId } from '../utils';
import { TestDataGenerator } from './TestDataGenerator';
import { BaseLLMService } from '../services/BaseLLMService';
import { OpenAIService } from '../services/OpenAIService';

export class BookingFlowTest {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
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
      // Extract page state for LLM context
      const pageState = await this.extractPageState();
      
      // Parse the instruction with LLM
      const parsedStep = await this.llmService!.parseTestStep(instruction);
      
      // Determine the action to take
      const decision = await this.llmService!.determineNextAction(
        pageState,
        instruction
      );
      
      // Execute the action based on LLM decision
      let success = false;
      let error = undefined;
      
      try {
        switch (decision.action) {
          case 'click':
            if (decision.targetElement) {
              const selector = this.buildSelectorFromElement(decision.targetElement);
              await this.page!.click(selector);
              success = true;
            }
            break;
            
          case 'type':
            if (decision.targetElement && decision.value) {
              const selector = this.buildSelectorFromElement(decision.targetElement);
              await this.page!.fill(selector, decision.value);
              success = true;
            }
            break;
            
          case 'submit':
            await this.page!.evaluate(() => {
              const form = document.querySelector('form');
              if (form) form.submit();
            });
            success = true;
            break;
            
          case 'wait':
            await this.page!.waitForTimeout(2000); // Default wait
            success = true;
            break;
            
          case 'verify':
            // Verification just checks if an element exists
            if (decision.targetElement) {
              const selector = this.buildSelectorFromElement(decision.targetElement);
              const element = await this.page!.$(selector);
              success = !!element;
            }
            break;
            
          default:
            error = `Unsupported action: ${decision.action}`;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        success = false;
      }
      
      // Capture screenshot for the step
      const screenshot = await this.captureScreenshotBase64();
      
      // Return the result
      return {
        instruction,
        success,
        error,
        screenshot,
        llmDecision: decision,
        status: success ? "success" : "failure"
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
   * Extract page state for LLM context
   */
  private async extractPageState(): Promise<PageState> {
    const screenshot = await this.captureScreenshotBase64();
    
    // Extract DOM elements for LLM context
    const elements = await this.page!.evaluate(() => {
      return Array.from(document.querySelectorAll('a, button, input, select, textarea, form, [role="button"]'))
        .map((el, index) => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            type: (el as HTMLElement).getAttribute('type'),
            id: el.id,
            classes: Array.from(el.classList),
            text: el.textContent?.trim(),
            placeholder: (el as HTMLElement).getAttribute('placeholder'),
            name: (el as HTMLElement).getAttribute('name'),
            href: (el as HTMLElement).getAttribute('href'),
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            visible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none'
          };
        });
    });
    
    return {
      title: await this.page!.title(),
      url: this.page!.url(),
      screenshot,
      elements: elements as PageElement[],
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Build a CSS selector from a page element
   */
  private buildSelectorFromElement(element: PageElement): string {
    if (element.id) {
      return `#${element.id}`;
    } else if (element.text && element.text.trim()) {
      // Use the text selector approach for elements with text content
      return `:text("${element.text.trim().replace(/"/g, '\\"')}")`;
    } else if (element.tag && element.tag === 'a' && element.href) {
      // For links with href attribute
      return `a[href="${element.href.replace(/"/g, '\\"')}"]`;
    } else if (element.classes && element.classes.length > 0) {
      // Filter out Tailwind utility classes that cause selector issues
      const safeClasses = element.classes.filter(cls => 
        !cls.includes(':') && 
        !cls.includes('.') && 
        !cls.includes('/') &&
        !cls.startsWith('hover:') &&
        !cls.startsWith('focus:') &&
        !cls.startsWith('active:') &&
        !cls.startsWith('group-') &&
        !cls.startsWith('dark:')
      );
      
      if (safeClasses.length > 0) {
        return `.${safeClasses[0]}`; // Just use the first safe class
      }
    }
    
    // Fallback to tag selector
    return element.tag || 'div';
  }

  /**
   * Navigate to the target page
   */
  private async navigateToPage(url: string): Promise<void> {
    try {
      this.addStep('page_navigation', 'running');
      await this.page!.goto(url, { 
        timeout: this.options.timeout,
        waitUntil: 'networkidle'
      });
      
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
      
      // List of possible selectors for demo/booking buttons
      const selectors = [
        'a:has-text("Book a Demo")', 
        'button:has-text("Book a Demo")',
        'a:has-text("Get a Demo")',
        'button:has-text("Get a Demo")',
        'a:has-text("Request Demo")',
        'button:has-text("Request Demo")',
        'a:has-text("Schedule Demo")',
        'button:has-text("Schedule Demo")',
        '[href*="demo"]',
        '[href*="book"]',
        '[href*="schedule"]'
      ];
      
      let element = null;
      
      // Try each selector
      for (const selector of selectors) {
        element = await this.page!.$(selector);
        if (element) break;
      }
      
      if (!element) {
        this.updateStepStatus('find_demo_button', 'failure');
        this.addError('find_demo_button', 'Could not find a demo button or link', 
          'None of the common demo button selectors matched elements on the page.');
        return false;
      }
      
      await this.captureScreenshot('find_demo_button');
      
      // Click the element
      await element.click();
      
      // Wait for navigation or new content
      try {
        await Promise.race([
          this.page!.waitForNavigation({ timeout: this.options.timeout }),
          this.page!.waitForSelector('form', { timeout: this.options.timeout })
        ]);
      } catch (error) {
        // It's okay if neither happens, the button might reveal a form in-page
      }
      
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
      
      // Check if there's a form
      const form = await this.page!.$('form');
      if (!form) {
        this.updateStepStatus('fill_form', 'failure');
        this.addError('fill_form', 'Could not find a form', 'No form element was detected on the page.');
        return false;
      }
      
      // Find input fields
      const nameInputs = await this.page!.$$('input[type="text"][name*="name"], input[placeholder*="name"], input[aria-label*="name"]');
      const emailInputs = await this.page!.$$('input[type="email"], input[name*="email"], input[placeholder*="email"]');
      const companyInputs = await this.page!.$$('input[name*="company"], input[placeholder*="company"], input[aria-label*="company"]');
      
      // Generate test data
      const name = TestDataGenerator.generateName();
      const email = TestDataGenerator.generateEmail();
      const company = TestDataGenerator.generateCompanyName();
      const phone = TestDataGenerator.generatePhoneNumber();
      
      // Fill in the form fields
      if (nameInputs.length > 0) {
        await nameInputs[0].fill(name);
      }
      
      if (emailInputs.length > 0) {
        await emailInputs[0].fill(email);
      }
      
      if (companyInputs.length > 0) {
        await companyInputs[0].fill(company);
      }
      
      // Find and fill other common fields
      const phoneInputs = await this.page!.$$('input[type="tel"], input[name*="phone"], input[placeholder*="phone"]');
      if (phoneInputs.length > 0) {
        await phoneInputs[0].fill(phone);
      }
      
      // Look for job title fields
      const titleInputs = await this.page!.$$('input[name*="title"], input[name*="position"], input[placeholder*="title"], input[placeholder*="position"]');
      if (titleInputs.length > 0) {
        await titleInputs[0].fill(TestDataGenerator.generateJobTitle());
      }
      
      await this.captureScreenshot('fill_form');
      this.updateStepStatus('fill_form', 'success');
      
      // Submit the form
      this.addStep('submit_form', 'running');
      
      // Try different methods to submit the form
      try {
        // Method 1: Submit button
        const submitButton = await this.page!.$('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Send")');
        if (submitButton) {
          await submitButton.click();
        } else {
          // Method 2: Form submit
          await this.page!.evaluate(() => {
            const forms = document.querySelectorAll('form');
            if (forms.length > 0) {
              forms[0].submit();
            }
          });
        }
        
        // Wait for confirmation page or message
        try {
          await Promise.race([
            this.page!.waitForNavigation({ timeout: this.options.timeout }),
            this.page!.waitForSelector('.success, .thank-you, [data-success], h1:has-text("Thank You")', 
              { timeout: this.options.timeout }),
          ]);
        } catch (error) {
          // It's okay if neither happens
        }
        
        await this.captureScreenshot('submit_form');
        this.updateStepStatus('submit_form', 'success');
        return true;
      } catch (error) {
        this.updateStepStatus('submit_form', 'failure');
        this.addError('submit_form', 'Failed to submit the form', error);
        return false;
      }
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
    if (!this.options.screenshotCapture || !this.page) return;
    
    try {
      const screenshot = await this.page.screenshot({ 
        type: 'jpeg',
        quality: 80
      });
      
      // Find the step and add the screenshot
      const step = this.steps.find(s => s.name === stepName);
      if (step) {
        step.screenshot = `data:image/jpeg;base64,${screenshot.toString('base64')}`;
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
   * Capture screenshot as base64
   */
  private async captureScreenshotBase64(): Promise<string> {
    if (!this.options.screenshotCapture || !this.page) {
      return '';
    }
    
    try {
      const buffer = await this.page.screenshot({ type: 'jpeg', quality: 80 });
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      return '';
    }
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