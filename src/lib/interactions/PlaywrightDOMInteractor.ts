import { Page, ElementHandle } from 'playwright';
import { BaseDOMInteractor, InteractableElement, NavigationOptions, WaitOptions, ElementRect } from './BaseDOMInteractor';

/**
 * Playwright implementation of the DOM interactor
 */
export class PlaywrightDOMInteractor extends BaseDOMInteractor {
  constructor(private page: Page) {
    super();
  }

  /**
   * Convert an InteractableElement to a CSS selector that Playwright can use
   */
  private buildSelector(element: InteractableElement): string {
    // Use predefined selector if available
    if (element.selector) {
      return element.selector;
    }

    // Use id if available (most reliable)
    if (element.id) {
      return `#${element.id}`;
    }

    // Use text content as selector if available
    if (element.text && element.text.trim()) {
      return `:text("${element.text.trim().replace(/"/g, '\\"')}")`;
    }

    // For links with href attribute
    if (element.tag === 'a' && element.attributes?.href) {
      return `a[href="${element.attributes.href.replace(/"/g, '\\"')}"]`;
    }

    // Use classes if available, filtering out problematic utility classes
    if (element.classes && element.classes.length > 0) {
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
        // For flex class, be more specific to target form elements only
        if (safeClasses.includes('flex')) {
          // Prioritize input elements when flex class is present
          if (element.tag === 'input' || element.tag === 'textarea' || element.tag === 'select') {
            return `${element.tag}${safeClasses.map(c => `.${c}`).join('')}`;
          }
          // For other tags, be more specific by combining tag and class
          else if (element.tag) {
            return `${element.tag}.${safeClasses[0]}`;
          }
          // If no tag but we have multiple classes, try to be more specific with multiple classes
          else if (safeClasses.length > 1) {
            return `.${safeClasses[0]}.${safeClasses[1]}`;
          }
        }
        
        return `.${safeClasses[0]}`; // Just use the first safe class
      }
    }

    // Use attributes if available
    if (element.attributes) {
      const attributeSelectors = Object.entries(element.attributes)
        .filter(([key, value]) => key && value !== undefined)
        .map(([key, value]) => `[${key}="${value!.replace(/"/g, '\\"')}"]`);
      
      if (attributeSelectors.length > 0) {
        return `${element.tag || '*'}${attributeSelectors.join('')}`;
      }
    }

    // Fallback to tag selector
    return element.tag || '*';
  }

  /**
   * Try to find an element with the provided InteractableElement details
   */
  private async findElement(element: InteractableElement): Promise<ElementHandle | null> {
    try {
      const selector = this.buildSelector(element);
      return await this.page.$(selector);
    } catch (error) {
      console.error('Error finding element:', error);
      return null;
    }
  }

  /**
   * Scroll element into view before interaction
   * @private
   */
  private async ensureElementInView(element: InteractableElement): Promise<ElementHandle | null> {
    try {
      const elementHandle = await this.findElement(element);
      if (elementHandle) {
        await elementHandle.scrollIntoViewIfNeeded();
        return elementHandle;
      }
      return null;
    } catch (error) {
      console.error('Scroll into view error:', error);
      return null;
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string, options?: NavigationOptions): Promise<boolean> {
    try {
      await this.page.goto(url, {
        timeout: options?.timeout || 30000,
        waitUntil: options?.waitUntil || 'networkidle'
      });
      return true;
    } catch (error) {
      console.error('Navigation error:', error);
      return false;
    }
  }

  /**
   * Click on an element
   */
  async click(element: InteractableElement): Promise<boolean> {
    try {
      const selector = this.buildSelector(element);
      
      // Ensure element is visible by scrolling to it
      const elementHandle = await this.ensureElementInView(element);
      if (!elementHandle) {
        console.warn(`Click failed: Element not found with selector ${selector}`);
        this._trackInteraction('click', false, selector);
        return false;
      }
      
      // Check if element is disabled
      const isDisabled = await elementHandle.evaluate(el => {
        return (el as HTMLElement).hasAttribute('disabled') || 
               (el as HTMLElement).classList.contains('disabled') || 
               (el as HTMLElement).getAttribute('aria-disabled') === 'true' ||
               (el as HTMLElement).getAttribute('data-disabled') === 'true';
      });
      
      if (isDisabled) {
        console.warn(`Click skipped: Element with selector ${selector} is disabled`);
        this._trackInteraction('click', false, selector);
        return false;
      }
      
      await this.page.click(selector);
      this._trackInteraction('click', true, selector);
      
      // Provide feedback after interaction
      const feedbackAfterAction = await this.getFormFeedback();
      console.log(`Click feedback for "${selector}":`, 
        JSON.stringify({
          url: feedbackAfterAction.url,
          title: feedbackAfterAction.title,
          formElementsCount: feedbackAfterAction.formElements.length
        }, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Click error:', error);
      this._trackInteraction('click', false, this.buildSelector(element));
      return false;
    }
  }

  /**
   * Fill a form field
   */
  async fill(element: InteractableElement, value: string): Promise<boolean> {
    try {
      const selector = this.buildSelector(element);
      
      // Ensure element is visible by scrolling to it
      const elementHandle = await this.ensureElementInView(element);
      if (!elementHandle) {
        console.warn(`Fill failed: Element not found with selector ${selector}`);
        this._trackInteraction('fill', false, selector);
        return false;
      }
      
      // Take screenshot for feedback before any action
      const beforeScreenshot = await this.takeScreenshot();
      
      // Verify element is an input, textarea, or has contenteditable attribute
      const elementInfo = await elementHandle.evaluate(el => {
        const tagName = (el as HTMLElement).tagName.toLowerCase();
        const id = (el as HTMLElement).id || '';
        const name = (el as HTMLElement).getAttribute('name') || '';
        const ariaLabel = (el as HTMLElement).getAttribute('aria-label') || '';
        const placeholder = (el as HTMLElement).getAttribute('placeholder') || '';
        const currentValue = (el as HTMLInputElement).value || '';
        const type = (el as HTMLElement).getAttribute('type') || '';
        const classes = Array.from((el as HTMLElement).classList);
        
        return {
          tagName,
          id,
          name,
          ariaLabel,
          placeholder,
          currentValue,
          type,
          classes,
          isFillable: tagName === 'input' || 
                      tagName === 'textarea' || 
                      tagName === 'select' || 
                      (el as HTMLElement).hasAttribute('contenteditable') ||
                      (el as HTMLElement).getAttribute('role') === 'textbox'
        };
      });
      
      // Log detailed element information for better debugging
      console.log(`Target element info:`, JSON.stringify(elementInfo, null, 2));
      
      if (!elementInfo.isFillable) {
        console.warn(`Fill skipped: Element with selector ${selector} is not fillable`);
        
        // Try to find a more specific input element inside the current element
        const inputInside = await this.page.$(`${selector} input, ${selector} textarea, ${selector} [contenteditable]`);
        if (inputInside) {
          await inputInside.scrollIntoViewIfNeeded();
          await inputInside.fill(value);
          
          // Take screenshot after action for feedback
          const afterScreenshot = await this.takeScreenshot();
          console.log(`Successfully filled inner input element with "${value}"`);
          this._trackInteraction('fill', true, `${selector} > input`);
          
          // Provide feedback after interaction
          const feedbackAfterAction = await this.getFormFeedback();
          console.log(`Fill feedback for inner element:`, 
            JSON.stringify({
              url: feedbackAfterAction.url,
              title: feedbackAfterAction.title,
              formElementsCount: feedbackAfterAction.formElements.length,
              filledFields: feedbackAfterAction.formElements.filter(el => el.isFilled).length
            }, null, 2)
          );
          
          return true;
        }
        
        this._trackInteraction('fill', false, selector);
        return false;
      }
      
      // If the field already has a value, we should not overwrite it
      // Instead, look for the next appropriate field
      if (elementInfo.currentValue && elementInfo.currentValue.trim() !== '') {
        console.log(`Element already has value: "${elementInfo.currentValue}". Will find the next appropriate empty input...`);
        
        // Get all potential form input elements
        const inputs = await this.page.$$('input[type="text"], input[type="email"], input:not([type]), textarea, [contenteditable="true"]');
        
        // Log all available inputs for debugging
        const inputsInfo = await Promise.all(inputs.map(async (input, index) => {
          return input.evaluate((el, idx) => {
            return {
              index: idx,
              id: (el as HTMLElement).id || '',
              name: (el as HTMLElement).getAttribute('name') || '',
              ariaLabel: (el as HTMLElement).getAttribute('aria-label') || '',
              placeholder: (el as HTMLElement).getAttribute('placeholder') || '',
              value: (el as HTMLInputElement).value || '',
              type: (el as HTMLElement).getAttribute('type') || '',
              isVisible: (el as HTMLElement).offsetParent !== null,
              boundingRect: el.getBoundingClientRect()
            };
          }, index);
        }));
        
        console.log(`Available inputs on the page:`, JSON.stringify(inputsInfo, null, 2));
        
        // Find our current element's index among all inputs
        const currentElementIndex = inputsInfo.findIndex(info => 
          info.id === elementInfo.id || 
          info.name === elementInfo.name || 
          info.ariaLabel === elementInfo.ariaLabel
        );
        
        console.log(`Current element index: ${currentElementIndex}`);
        
        // Look for the next empty input after our current one
        let nextEmptyInputIndex = -1;
        
        if (currentElementIndex !== -1) {
          for (let i = currentElementIndex + 1; i < inputsInfo.length; i++) {
            if (inputsInfo[i].isVisible && (!inputsInfo[i].value || inputsInfo[i].value.trim() === '')) {
              nextEmptyInputIndex = i;
              break;
            }
          }
        } else {
          // If we couldn't find our current element, look for the first empty input
          nextEmptyInputIndex = inputsInfo.findIndex(info => 
            info.isVisible && (!info.value || info.value.trim() === '')
          );
        }
        
        // If we found a next empty input, fill it
        if (nextEmptyInputIndex !== -1) {
          console.log(`Found next empty input at index ${nextEmptyInputIndex}:`, JSON.stringify(inputsInfo[nextEmptyInputIndex], null, 2));
          
          const nextInput = inputs[nextEmptyInputIndex];
          await nextInput.scrollIntoViewIfNeeded();
          await nextInput.fill(value);
          
          // Generate selector for tracking
          const nextInputInfo = inputsInfo[nextEmptyInputIndex];
          let nextInputSelector = 'input';
          if (nextInputInfo.id) nextInputSelector = `#${nextInputInfo.id}`;
          else if (nextInputInfo.name) nextInputSelector = `[name="${nextInputInfo.name}"]`;
          
          // Take screenshot after action for feedback
          const afterScreenshot = await this.takeScreenshot();
          console.log(`Successfully filled next empty input with "${value}"`);
          this._trackInteraction('fill', true, nextInputSelector);
          
          // Provide feedback after interaction
          const feedbackAfterAction = await this.getFormFeedback();
          console.log(`Fill feedback for next field:`, 
            JSON.stringify({
              url: feedbackAfterAction.url,
              title: feedbackAfterAction.title,
              formElementsCount: feedbackAfterAction.formElements.length,
              filledFields: feedbackAfterAction.formElements.filter(el => el.isFilled).length
            }, null, 2)
          );
          
          return true;
        } else {
          console.warn(`Could not find a next empty input to fill with "${value}"`);
          this._trackInteraction('fill', false, selector);
          return false;
        }
      }
      
      // If we reach here, it means our target element is fillable and empty
      await this.page.fill(selector, value);
      
      // Take screenshot after action for feedback
      const afterScreenshot = await this.takeScreenshot();
      console.log(`Successfully filled "${selector}" with "${value}"`);
      this._trackInteraction('fill', true, selector);
      
      // Provide feedback after interaction
      const feedbackAfterAction = await this.getFormFeedback();
      console.log(`Fill feedback:`, 
        JSON.stringify({
          url: feedbackAfterAction.url,
          title: feedbackAfterAction.title,
          formElementsCount: feedbackAfterAction.formElements.length,
          filledFields: feedbackAfterAction.formElements.filter(el => el.isFilled).length
        }, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Fill error:', error);
      
      // Take screenshot on error for feedback
      const errorScreenshot = await this.takeScreenshot();
      console.log(`Error screenshot taken after fill attempt failed`);
      this._trackInteraction('fill', false, this.buildSelector(element));
      
      return false;
    }
  }

  /**
   * Select an option from a dropdown
   */
  async select(element: InteractableElement, value: string): Promise<boolean> {
    try {
      const selector = this.buildSelector(element);
      
      // Take screenshot before action
      const beforeScreenshot = await this.takeScreenshot();
      
      // Ensure element is visible by scrolling to it
      const elementHandle = await this.ensureElementInView(element);
      if (!elementHandle) {
        console.warn(`Select failed: Element not found with selector ${selector}`);
        this._trackInteraction('select', false, selector);
        return false;
      }
      
      // Check if it's a standard select element
      const isStandardSelect = await elementHandle.evaluate(el => {
        return (el as HTMLElement).tagName.toLowerCase() === 'select';
      });
      
      if (isStandardSelect) {
        await this.page.selectOption(selector, value);
        this._trackInteraction('select', true, selector);
        
        // Provide feedback after interaction
        const feedbackAfterAction = await this.getFormFeedback();
        console.log(`Select feedback:`, 
          JSON.stringify({
            url: feedbackAfterAction.url,
            title: feedbackAfterAction.title,
            selectedValue: value
          }, null, 2)
        );
        
        return true;
      }
      
      // Handle non-standard selects like Google Forms dropdown
      // First click to open the dropdown
      await elementHandle.click();
      await this.page.waitForTimeout(500); // Wait for dropdown to open
      
      // Try to find the option in the dropdown by text content
      const optionSelector = `text="${value}"`;
      try {
        // Wait for the dropdown options to be visible
        await this.page.waitForSelector(optionSelector, { timeout: 5000 });
        // Click the option
        await this.page.click(optionSelector);
        this._trackInteraction('select', true, `${selector} > ${optionSelector}`);
        
        // Provide feedback after interaction
        const feedbackAfterAction = await this.getFormFeedback();
        console.log(`Custom select feedback:`, 
          JSON.stringify({
            url: feedbackAfterAction.url,
            title: feedbackAfterAction.title,
            selectedValue: value
          }, null, 2)
        );
        
        return true;
      } catch (error) {
        console.warn(`Could not find option with text "${value}" in dropdown`);
        // If we can't find the option by text, try to find input element for "Other" option
        const otherInputSelector = `${selector} input, .Hvn9fb, input[aria-label="Other response"]`;
        try {
          const otherInput = await this.page.$(otherInputSelector);
          if (otherInput) {
            await otherInput.fill(value);
            this._trackInteraction('select', true, otherInputSelector);
            return true;
          }
        } catch (inputError) {
          console.error('Failed to fill other input:', inputError);
        }
        this._trackInteraction('select', false, selector);
        return false;
      }
    } catch (error) {
      console.error('Select error:', error);
      this._trackInteraction('select', false, this.buildSelector(element));
      return false;
    }
  }

  /**
   * Check or uncheck a checkbox
   */
  async check(element: InteractableElement, state: boolean = true): Promise<boolean> {
    try {
      const selector = this.buildSelector(element);
      
      // Ensure element is visible by scrolling to it
      const elementHandle = await this.ensureElementInView(element);
      if (!elementHandle) {
        console.warn(`Check/uncheck failed: Element not found with selector ${selector}`);
        this._trackInteraction('check', false, selector);
        return false;
      }
      
      // Check if it's a standard checkbox or radio button
      const isStandardCheckable = await elementHandle.evaluate(el => {
        const tag = (el as HTMLElement).tagName.toLowerCase();
        const type = (el as HTMLElement).getAttribute('type')?.toLowerCase();
        return (tag === 'input' && (type === 'checkbox' || type === 'radio'));
      });
      
      if (isStandardCheckable) {
        if (state) {
          await this.page.check(selector);
        } else {
          await this.page.uncheck(selector);
        }
        this._trackInteraction(state ? 'check' : 'uncheck', true, selector);
        
        // Provide feedback after interaction
        const feedbackAfterAction = await this.getFormFeedback();
        console.log(`Check/uncheck feedback:`, 
          JSON.stringify({
            url: feedbackAfterAction.url,
            title: feedbackAfterAction.title,
            action: state ? 'check' : 'uncheck'
          }, null, 2)
        );
        
        return true;
      }
      
      // If not a standard checkbox/radio, try different approaches
      
      // 1. For Google Forms, handle radio options that might have specific patterns
      // Try to find radio input within the element
      const radioInputs = await this.page.$$(`${selector} input[type="radio"], ${selector} [role="radio"]`);
      if (radioInputs.length > 0) {
        console.log(`Found ${radioInputs.length} radio input(s) inside element. Clicking the first one.`);
        await radioInputs[0].click();
        this._trackInteraction('radio-check', true, selector);
        return true;
      }
      
      // 2. For Google Forms with labels that wrap inputs
      try {
        // Try to locate by label text
        if (element.text) {
          const textSelector = `label:has-text("${element.text.replace(/"/g, '\\"')}")`;
          const labelElement = await this.page.$(textSelector);
          if (labelElement) {
            console.log(`Found label with text: "${element.text}". Clicking it.`);
            await labelElement.click();
            this._trackInteraction('label-click', true, textSelector);
            return true;
          }
          
          // Try direct text search for Google Forms radio buttons
          const exactTextSelector = `text="${element.text.replace(/"/g, '\\"')}"`;
          const exactTextElement = await this.page.$(exactTextSelector);
          if (exactTextElement) {
            console.log(`Found element with exact text: "${element.text}". Clicking it.`);
            await exactTextElement.click();
            this._trackInteraction('text-click', true, exactTextSelector);
            return true;
          }
        }
      } catch (labelError) {
        console.warn('Failed to find by label:', labelError);
      }
      
      // 3. If all else fails, try to click it
      console.log(`Element with selector ${selector} is not a standard checkbox or radio button. Attempting to click instead.`);
      await elementHandle.click();
      this._trackInteraction('fallback-click', true, selector);
      
      // Provide feedback after interaction
      const feedbackAfterAction = await this.getFormFeedback();
      console.log(`Fallback click feedback:`, 
        JSON.stringify({
          url: feedbackAfterAction.url,
          title: feedbackAfterAction.title
        }, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Check/uncheck error:', error);
      this._trackInteraction('check', false, this.buildSelector(element));
      return false;
    }
  }

  /**
   * Press a key
   */
  async pressKey(key: string): Promise<boolean> {
    try {
      await this.page.keyboard.press(key);
      return true;
    } catch (error) {
      console.error('Key press error:', error);
      return false;
    }
  }

  /**
   * Hover over an element
   */
  async hover(element: InteractableElement): Promise<boolean> {
    try {
      const selector = this.buildSelector(element);
      
      // Ensure element is visible by scrolling to it
      const elementHandle = await this.ensureElementInView(element);
      if (!elementHandle) {
        console.warn(`Hover failed: Element not found with selector ${selector}`);
        return false;
      }
      
      await this.page.hover(selector);
      return true;
    } catch (error) {
      console.error('Hover error:', error);
      return false;
    }
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(element: InteractableElement, options?: WaitOptions): Promise<boolean> {
    try {
      const selector = this.buildSelector(element);
      await this.page.waitForSelector(selector, {
        timeout: options?.timeout || 30000,
        state: options?.state || 'visible'
      });
      return true;
    } catch (error) {
      console.error('Wait for element error:', error);
      return false;
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(options?: WaitOptions): Promise<boolean> {
    try {
      await this.page.waitForNavigation({
        timeout: options?.timeout || 30000,
        waitUntil: 'networkidle'
      });
      return true;
    } catch (error) {
      console.error('Wait for navigation error:', error);
      return false;
    }
  }

  /**
   * Get text content of an element
   */
  async getText(element: InteractableElement): Promise<string> {
    try {
      const selector = this.buildSelector(element);
      return await this.page.textContent(selector) || '';
    } catch (error) {
      console.error('Get text error:', error);
      return '';
    }
  }

  /**
   * Get value of an input element
   */
  async getValue(element: InteractableElement): Promise<string> {
    try {
      const selector = this.buildSelector(element);
      return await this.page.inputValue(selector);
    } catch (error) {
      console.error('Get value error:', error);
      return '';
    }
  }

  /**
   * Check if element exists
   */
  async exists(element: InteractableElement): Promise<boolean> {
    const elem = await this.findElement(element);
    return !!elem;
  }

  /**
   * Check if element is visible
   */
  async isVisible(element: InteractableElement): Promise<boolean> {
    try {
      const selector = this.buildSelector(element);
      return await this.page.isVisible(selector);
    } catch (error) {
      console.error('Is visible error:', error);
      return false;
    }
  }

  /**
   * Get current page title
   */
  async getPageTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Get current page URL
   */
  async getPageUrl(): Promise<string> {
    return this.page.url();
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(): Promise<string> {
    try {
      const buffer = await this.page.screenshot({ type: 'jpeg', quality: 80 });
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (error) {
      console.error('Screenshot error:', error);
      return '';
    }
  }

  /**
   * Get all interactable elements on the page
   */
  async getInteractableElements(): Promise<InteractableElement[]> {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('a, button, input, select, textarea, form, [role="button"]'))
        .map((el, index) => {
          const rect = el.getBoundingClientRect();
          const attributes: Record<string, string> = {};
          
          // Convert attributes to a plain object
          Array.from(el.attributes).forEach(attr => {
            attributes[attr.name] = attr.value;
          });
          
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || undefined,
            classes: Array.from(el.classList),
            text: el.textContent?.trim() || undefined,
            attributes,
            index,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            }
          };
        }).filter(el => {
          // Filter out hidden elements
          return el.rect.width > 0 && 
                 el.rect.height > 0 && 
                 el.attributes['style']?.includes('display: none') !== true &&
                 el.attributes['hidden'] !== 'true';
        });
    });
  }

  /**
   * Submit a form
   */
  async submitForm(formElement?: InteractableElement): Promise<boolean> {
    try {
      if (formElement) {
        const selector = this.buildSelector(formElement);
        await this.page.dispatchEvent(selector, 'submit');
      } else {
        // Try to find a submit button first
        const submitButton = await this.page.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
          await submitButton.click();
        } else {
          // If no submit button, try to submit the form directly
          await this.page.evaluate(() => {
            const form = document.querySelector('form');
            if (form) form.submit();
          });
        }
      }
      return true;
    } catch (error) {
      console.error('Form submit error:', error);
      return false;
    }
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(element: InteractableElement): Promise<boolean> {
    try {
      const elementHandle = await this.findElement(element);
      if (elementHandle) {
        await elementHandle.scrollIntoViewIfNeeded();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Scroll error:', error);
      return false;
    }
  }

  /**
   * Execute custom JavaScript in the page context
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    return await this.page.evaluate(fn);
  }

  /**
   * Take a screenshot and return detailed information about the current state
   */
  async captureState(): Promise<{
    screenshot: string,
    url: string,
    title: string,
    visibleElements: InteractableElement[]
  }> {
    try {
      const screenshot = await this.takeScreenshot();
      const url = this.page.url();
      const title = await this.page.title();
      const visibleElements = await this.getInteractableElements();
      
      console.log(`Captured page state: ${title} (${url})`);
      console.log(`Found ${visibleElements.length} interactable elements`);
      
      return {
        screenshot,
        url,
        title,
        visibleElements
      };
    } catch (error) {
      console.error('Capture state error:', error);
      return {
        screenshot: '',
        url: this.page.url(),
        title: '',
        visibleElements: []
      };
    }
  }

  /**
   * Get detailed information about a specific element
   */
  async getElementDetails(element: InteractableElement): Promise<any> {
    try {
      const elementHandle = await this.findElement(element);
      if (!elementHandle) {
        return null;
      }
      
      return await elementHandle.evaluate((el) => {
        // Ensure el is treated as HTMLElement
        const htmlEl = el as HTMLElement;
        
        // Get computed styles
        const styles = window.getComputedStyle(htmlEl);
        
        // Get bounding rectangle
        const rect = htmlEl.getBoundingClientRect();
        
        // Get attributes
        const attributes: Record<string, string> = {};
        Array.from(htmlEl.attributes).forEach(attr => {
          attributes[attr.name] = attr.value;
        });
        
        // Get element state
        const isDisabled = 
          htmlEl.hasAttribute('disabled') ||
          htmlEl.classList.contains('disabled') ||
          attributes['aria-disabled'] === 'true';
          
        const isReadOnly =
          htmlEl.hasAttribute('readonly') ||
          attributes['aria-readonly'] === 'true';
          
        const isFocused = document.activeElement === htmlEl;
        
        // For input elements, get value
        let value = '';
        if (htmlEl instanceof HTMLInputElement || htmlEl instanceof HTMLTextAreaElement || htmlEl instanceof HTMLSelectElement) {
          value = htmlEl.value;
        }
        
        return {
          tagName: htmlEl.tagName.toLowerCase(),
          id: htmlEl.id || undefined,
          classes: Array.from(htmlEl.classList),
          text: htmlEl.textContent?.trim() || undefined,
          attributes,
          styles: {
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            zIndex: styles.zIndex,
            position: styles.position
          },
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left
          },
          state: {
            isDisabled,
            isReadOnly,
            isFocused,
            isHidden: styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0'
          },
          value
        };
      });
    } catch (error) {
      console.error('Get element details error:', error);
      return null;
    }
  }

  /**
   * Provides comprehensive feedback about the current form state
   * This helps the LLM make better decisions about next interactions
   */
  async getFormFeedback(): Promise<{
    screenshot: string;
    url: string;
    title: string;
    formElements: {
      tagName: string;
      id: string;
      name: string;
      type: string;
      value: string;
      placeholder: string;
      ariaLabel: string;
      label: string;
      isFilled: boolean;
      isVisible: boolean;
      isRequired: boolean;
      rect: ElementRect;
    }[];
    lastInteractionResult: {
      action: string;
      success: boolean;
      selector: string;
      timestamp: number;
    } | null;
  }> {
    try {
      // Capture screenshot
      const screenshot = await this.takeScreenshot();
      const url = this.page.url();
      const title = await this.page.title();
      
      // Get form elements
      const formElements = await this.page.evaluate(() => {
        // Helper function to find label text for an input
        const getLabelText = (el: HTMLElement): string => {
          // Check for label with 'for' attribute
          if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label && label.textContent) {
              return label.textContent.trim();
            }
          }
          
          // Check for parent label
          let parent = el.parentElement;
          while (parent) {
            if (parent.tagName === 'LABEL' && parent.textContent) {
              return parent.textContent.trim().replace(el.textContent || '', '').trim();
            }
            parent = parent.parentElement;
          }
          
          // Check for preceding label or div with label-like classes
          let previousEl = el.previousElementSibling;
          while (previousEl) {
            if ((previousEl.tagName === 'LABEL' || 
                (previousEl.tagName === 'DIV' && 
                 (previousEl.className.includes('label') || 
                  previousEl.className.includes('field-name')))) && 
                previousEl.textContent) {
              return previousEl.textContent.trim();
            }
            previousEl = previousEl.previousElementSibling;
          }
          
          return '';
        };
        
        // Find all form inputs, textareas, and selects
        const elements = Array.from(document.querySelectorAll(
          'input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="textbox"]'
        ));
        
        return elements.map(el => {
          const htmlEl = el as HTMLElement;
          const rect = htmlEl.getBoundingClientRect();
          const styles = window.getComputedStyle(htmlEl);
          
          // Check if element is visible
          const isVisible = !(styles.display === 'none' || 
                             styles.visibility === 'hidden' || 
                             styles.opacity === '0' ||
                             rect.width === 0 ||
                             rect.height === 0);
          
          // Get value
          let value = '';
          if (htmlEl instanceof HTMLInputElement || 
              htmlEl instanceof HTMLTextAreaElement || 
              htmlEl instanceof HTMLSelectElement) {
            value = htmlEl.value;
          } else if (htmlEl.hasAttribute('contenteditable')) {
            value = htmlEl.textContent || '';
          }
          
          // Get other attributes
          const id = htmlEl.id || '';
          const name = htmlEl.getAttribute('name') || '';
          const type = htmlEl instanceof HTMLInputElement ? 
                      htmlEl.type : 
                      htmlEl.tagName.toLowerCase();
          const placeholder = htmlEl.getAttribute('placeholder') || '';
          const ariaLabel = htmlEl.getAttribute('aria-label') || '';
          const isRequired = htmlEl.hasAttribute('required') || 
                            htmlEl.getAttribute('aria-required') === 'true';
          
          // Get associated label text
          const label = getLabelText(htmlEl);
          
          return {
            tagName: htmlEl.tagName.toLowerCase(),
            id,
            name,
            type,
            value,
            placeholder,
            ariaLabel,
            label,
            isFilled: value.trim() !== '',
            isVisible,
            isRequired,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            }
          };
        });
      });
      
      // Sort form elements by vertical position (top to bottom)
      const sortedFormElements = formElements
        .filter(el => el.isVisible)
        .sort((a, b) => a.rect.y - b.rect.y);
      
      // Log the form state for debugging
      console.log('Form feedback:', {
        url,
        title,
        formElementsCount: sortedFormElements.length,
        filledElements: sortedFormElements.filter(el => el.isFilled).length
      });
      
      // Return structured data for LLM
      return {
        screenshot,
        url,
        title,
        formElements: sortedFormElements,
        lastInteractionResult: this._lastInteraction || null
      };
    } catch (error) {
      console.error('Get form feedback error:', error);
      return {
        screenshot: '',
        url: this.page.url(),
        title: '',
        formElements: [],
        lastInteractionResult: null
      };
    }
  }
  
  // Track the last interaction for feedback
  private _lastInteraction: {
    action: string;
    success: boolean;
    selector: string;
    timestamp: number;
  } | null = null;
  
  /**
   * Update the last interaction tracker
   */
  private _trackInteraction(action: string, success: boolean, selector: string): void {
    this._lastInteraction = {
      action,
      success,
      selector,
      timestamp: Date.now()
    };
  }
} 