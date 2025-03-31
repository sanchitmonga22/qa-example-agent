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
   * Select an option from a dropdown or radio group
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
      
      // Get element info to determine best strategy
      const elementInfo = await elementHandle.evaluate(el => {
        const tagName = (el as HTMLElement).tagName.toLowerCase();
        const type = (el as HTMLElement).getAttribute('type')?.toLowerCase();
        const role = (el as HTMLElement).getAttribute('role')?.toLowerCase();
        const classes = Array.from((el as HTMLElement).classList || []);
        
        return {
          tagName,
          type,
          role,
          classes
        };
      });
      
      // For select elements, use selectOption
      if (elementInfo.tagName === 'select') {
        await this.page.selectOption(selector, value);
        return true;
      }
      
      // For input fields that need text entry
      if (elementInfo.tagName === 'input' && (elementInfo.type === 'text' || !elementInfo.type)) {
        // For text inputs, just fill the value
        await this.page.fill(selector, value);
        return true;
      }
      
      // For radio buttons with the same name
      if (elementInfo.tagName === 'input' && elementInfo.type === 'radio') {
        // Get the name attribute
        const radioName = await elementHandle.evaluate(el => (el as HTMLElement).getAttribute('name'));
        
        if (radioName) {
          // Strategy 1: Try to find radio with matching value
          const radioValueSelector = `input[type="radio"][name="${radioName}"][value="${value}"]`;
          const radioByValue = await this.page.$(radioValueSelector);
          
          if (radioByValue) {
            await radioByValue.click();
            return true;
          }
          
          // Strategy 2: Try to find radio with matching label text
          const radioButtons = await this.page.$$(`input[type="radio"][name="${radioName}"]`);
          for (const radio of radioButtons) {
            const labelText = await radio.evaluate(el => {
              // Check for label by for attribute
              const id = (el as HTMLElement).id;
              if (id) {
                const label = document.querySelector(`label[for="${id}"]`);
                if (label && label.textContent) return label.textContent.trim();
              }
              
              // Check for parent label
              let parent = el.parentElement;
              while (parent) {
                if (parent.tagName.toLowerCase() === 'label' && parent.textContent) {
                  return parent.textContent.trim();
                }
                parent = parent.parentElement;
              }
              
              // Check nearby sibling for label
              const siblings = Array.from(el.parentElement?.children || []);
              for (const sibling of siblings) {
                if (sibling.tagName.toLowerCase() === 'label' && sibling.textContent) {
                  return sibling.textContent.trim();
                }
              }
              
              return '';
            });
            
            if (labelText.toLowerCase().includes(value.toLowerCase())) {
              await radio.click();
              return true;
            }
          }
        }
      }
      
      // For custom select/dropdown components
      if (elementInfo.role === 'combobox' || elementInfo.role === 'listbox') {
        // Click to open dropdown
        await this.page.click(selector);
        await this.page.waitForTimeout(300); // Wait for dropdown to appear
        
        // Try to find an option with the given text
        const optionSelector = `[role="option"]:has-text("${value}"), li:has-text("${value}")`;
        const option = await this.page.$(optionSelector);
        
        if (option) {
          await option.click();
          return true;
        }
      }
      
      // Generic approach for any form: try to find any radio button with matching label text
      const allRadios = await this.page.$$('input[type="radio"]');
      for (const radio of allRadios) {
        // Get label text
        const labelText = await radio.evaluate(el => {
          const id = (el as HTMLElement).id;
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) return label.textContent || '';
          }
          
          // Check surrounding text
          let parentEl = el.parentElement;
          while (parentEl && parentEl.textContent) {
            const textContent = parentEl.textContent.trim();
            if (textContent.length > 0) {
              return textContent;
            }
            parentEl = parentEl.parentElement;
          }
          
          return '';
        });
        
        if (labelText && labelText.trim().toLowerCase() === value.toLowerCase()) {
          await radio.click();
          return true;
        }
      }
      
      // Try a fallback approach with "Other" option and text input
      const otherRadios = await this.page.$$('input[type="radio"][value="other"], input[type="radio"][value="Other"]');
      
      if (otherRadios.length > 0) {
        // Click the "Other" radio button
        await otherRadios[0].click();
        await this.page.waitForTimeout(100);
        
        // Then find any nearby text input field
        const otherInput = await this.page.$('input[type="text"]:near(input[type="radio"][value="other"], input[type="radio"][value="Other"])');
        if (otherInput) {
          await otherInput.fill(value);
          return true;
        }
      }
      
      console.warn(`Select failed: Could not find a way to select "${value}" on element ${selector}`);
      return false;
    } catch (error) {
      console.error('Select error:', error);
      return false;
    }
  }

  /**
   * Check or uncheck a checkbox or select a radio button
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
      
      // Verify element type to determine the best interaction approach
      const elementInfo = await elementHandle.evaluate(el => {
        const tagName = (el as HTMLElement).tagName.toLowerCase();
        const type = (el as HTMLElement).getAttribute('type')?.toLowerCase();
        const role = (el as HTMLElement).getAttribute('role')?.toLowerCase();
        const ariaChecked = (el as HTMLElement).getAttribute('aria-checked');
        
        return {
          tagName,
          type,
          role,
          ariaChecked
        };
      });
      
      // For standard checkboxes and radio buttons
      if (elementInfo.tagName === 'input' && (elementInfo.type === 'checkbox' || elementInfo.type === 'radio')) {
        if (state) {
          await this.page.check(selector);
        } else if (elementInfo.type === 'checkbox') { // Only uncheck checkboxes, not radio buttons
          await this.page.uncheck(selector);
        }
        return true;
      }
      
      // For ARIA checkbox/radio buttons
      if (elementInfo.role === 'checkbox' || elementInfo.role === 'radio') {
        const isCurrentlyChecked = elementInfo.ariaChecked === 'true';
        if ((state && !isCurrentlyChecked) || (!state && isCurrentlyChecked)) {
          await this.page.click(selector);
        }
        return true;
      }
      
      // For div/span that wraps a checkbox or radio (common pattern)
      if (['div', 'span', 'label'].includes(elementInfo.tagName)) {
        // Try to find an actual checkbox/radio inside
        const innerCheckable = await this.page.$(`${selector} input[type="checkbox"], ${selector} input[type="radio"]`);
        if (innerCheckable) {
          if (state) {
            await innerCheckable.check();
          } else {
            const innerType = await innerCheckable.evaluate(el => (el as HTMLElement).getAttribute('type'));
            if (innerType === 'checkbox') {
              await innerCheckable.uncheck();
            }
          }
          return true;
        }
        
        // If no checkbox/radio inside, the element might be a custom control
        // Try looking for a nearby radio button using spatial relationship
        const nearbyCheckables = await this.page.$$('input[type="radio"], input[type="checkbox"]');
        
        if (nearbyCheckables.length > 0) {
          // Get the bounding box of our target element
          const elBBox = await elementHandle.boundingBox();
          
          if (elBBox) {
            // Calculate the center point of our element
            const elCenterX = elBBox.x + elBBox.width / 2;
            const elCenterY = elBBox.y + elBBox.height / 2;
            
            // Find distances to each checkable element
            const elementDistances = await Promise.all(
              nearbyCheckables.map(async (el) => {
                const bbox = await el.boundingBox();
                if (!bbox) return { element: el, distance: Infinity };
                
                const itemCenterX = bbox.x + bbox.width / 2;
                const itemCenterY = bbox.y + bbox.height / 2;
                
                // Calculate Euclidean distance
                const distance = Math.sqrt(
                  Math.pow(elCenterX - itemCenterX, 2) + 
                  Math.pow(elCenterY - itemCenterY, 2)
                );
                
                return { element: el, distance };
              })
            );
            
            // Sort by distance
            elementDistances.sort((a, b) => a.distance - b.distance);
            
            // Click/check the closest element
            if (elementDistances.length > 0 && elementDistances[0].distance < 100) { // 100px threshold
              const closestElement = elementDistances[0].element;
              const type = await closestElement.evaluate(el => (el as HTMLElement).getAttribute('type'));
              
              if (state) {
                await closestElement.check();
              } else if (type === 'checkbox') {
                await closestElement.uncheck();
              }
              return true;
            }
          }
        }
      }
      
      // If all else fails, just try clicking the element
      if (state) {
        console.warn(`Element with selector ${selector} is not a standard checkbox or radio button. Attempting to click instead.`);
        await this.page.click(selector);
        return true;
      }
      
      console.warn(`Check failed: Element with selector ${selector} is not a checkbox or radio button`);
      return false;
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