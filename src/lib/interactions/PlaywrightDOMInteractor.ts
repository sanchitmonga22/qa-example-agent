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
        return false;
      }
      
      await this.page.click(selector);
      return true;
    } catch (error) {
      console.error('Click error:', error);
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
        return false;
      }
      
      // Verify element is an input, textarea, or has contenteditable attribute
      const isFillable = await elementHandle.evaluate(el => {
        const tagName = (el as HTMLElement).tagName.toLowerCase();
        return tagName === 'input' || 
               tagName === 'textarea' || 
               tagName === 'select' || 
               (el as HTMLElement).hasAttribute('contenteditable') ||
               (el as HTMLElement).getAttribute('role') === 'textbox';
      });
      
      if (!isFillable) {
        console.warn(`Fill skipped: Element with selector ${selector} is not fillable`);
        
        // Try to find a more specific input element inside the current element
        const inputInside = await this.page.$(`${selector} input, ${selector} textarea, ${selector} [contenteditable]`);
        if (inputInside) {
          await inputInside.scrollIntoViewIfNeeded();
          await inputInside.fill(value);
          return true;
        }
        
        return false;
      }
      
      await this.page.fill(selector, value);
      return true;
    } catch (error) {
      console.error('Fill error:', error);
      return false;
    }
  }

  /**
   * Select an option from a dropdown
   */
  async select(element: InteractableElement, value: string): Promise<boolean> {
    try {
      const selector = this.buildSelector(element);
      
      // Ensure element is visible by scrolling to it
      const elementHandle = await this.ensureElementInView(element);
      if (!elementHandle) {
        console.warn(`Select failed: Element not found with selector ${selector}`);
        return false;
      }
      
      await this.page.selectOption(selector, value);
      return true;
    } catch (error) {
      console.error('Select error:', error);
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
        return false;
      }
      
      if (state) {
        await this.page.check(selector);
      } else {
        await this.page.uncheck(selector);
      }
      return true;
    } catch (error) {
      console.error('Check/uncheck error:', error);
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
} 