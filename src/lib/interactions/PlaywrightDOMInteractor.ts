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
        this._trackInteractionWithDetails('click', 'click', false, selector);
        return false;
      }
      
      // Get element details for better tracking
      const elementInfo = await elementHandle.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        return {
          tag: htmlEl.tagName.toLowerCase(),
          id: htmlEl.id || '',
          type: htmlEl.getAttribute('type') || '',
          ariaLabel: htmlEl.getAttribute('aria-label') || '',
          text: htmlEl.textContent?.trim() || '',
          classes: Array.from(htmlEl.classList),
          role: htmlEl.getAttribute('role') || '',
          label: htmlEl.closest('label')?.textContent?.trim() || '',
          isInputControl: htmlEl.tagName.toLowerCase() === 'input' || 
                          htmlEl.tagName.toLowerCase() === 'button' || 
                          htmlEl.getAttribute('role') === 'button' ||
                          htmlEl.getAttribute('role') === 'radio' ||
                          htmlEl.getAttribute('role') === 'checkbox'
        };
      });
      
      // Check if element is disabled
      const isDisabled = await elementHandle.evaluate(el => {
        return (el as HTMLElement).hasAttribute('disabled') || 
               (el as HTMLElement).classList.contains('disabled') || 
               (el as HTMLElement).getAttribute('aria-disabled') === 'true' ||
               (el as HTMLElement).getAttribute('data-disabled') === 'true';
      });
      
      if (isDisabled) {
        console.warn(`Click skipped: Element with selector ${selector} is disabled`);
        this._trackInteractionWithDetails('click', 'click', false, selector, {
          label: elementInfo.ariaLabel || elementInfo.label || elementInfo.text,
          type: elementInfo.type || elementInfo.role || elementInfo.tag
        });
        return false;
      }
      
      // Determine the appropriate action type for tracking
      let actionType = 'click';
      if (elementInfo.tag === 'input' && elementInfo.type === 'radio' || elementInfo.role === 'radio') {
        actionType = 'select';
      } else if (elementInfo.tag === 'input' && elementInfo.type === 'checkbox' || elementInfo.role === 'checkbox') {
        actionType = 'check';
      } else if (elementInfo.tag === 'button' || elementInfo.role === 'button') {
        actionType = 'button-click';
      }
      
      await this.page.click(selector);
      
      const elementValue = element.text || elementInfo.text;
      this._trackInteractionWithDetails(
        'click', 
        actionType, 
        true, 
        selector, 
        {
          label: elementInfo.ariaLabel || elementInfo.label || elementInfo.text,
          type: elementInfo.type || elementInfo.role || elementInfo.tag,
          value: elementValue
        }
      );
      
      // Provide feedback after interaction
      const feedbackAfterAction = await this.getFormFeedback();
      console.log(`Click feedback for "${selector}":`, 
        JSON.stringify({
          url: feedbackAfterAction.url,
          title: feedbackAfterAction.title,
          formElementsCount: feedbackAfterAction.formElements.length
        }, null, 2)
      );
      
      // Check if we clicked a radio option that might require additional input
      if (actionType === 'select') {
        // Check if this was an option that might require text input
        const hasOtherInput = await this.page.evaluate((sel) => {
          const clickedEl = document.querySelector(sel);
          if (!clickedEl) return false;
          
          // Check if we're in an option container with a text input
          const container = clickedEl.closest('[role="radiogroup"]');
          if (!container) return false;
          
          // Find nearby input field
          return container.querySelector('input[type="text"]') !== null;
        }, selector);
        
        if (hasOtherInput) {
          console.log(`Selected option which may require additional text input.`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Click error:', error);
      this._trackInteractionWithDetails('click', 'click', false, this.buildSelector(element));
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
        this._trackInteractionWithDetails('fill', 'type', false, selector, { value });
        return false;
      }
      
      // Take screenshot for feedback before any action
      const beforeScreenshot = await this.takeScreenshot();
      
      // Verify element is an input, textarea, or has contenteditable attribute
      const elementInfo = await elementHandle.evaluate(el => {
        const htmlEl = el as HTMLElement;
        const tagName = htmlEl.tagName.toLowerCase();
        const id = htmlEl.id || '';
        const name = htmlEl.getAttribute('name') || '';
        const ariaLabel = htmlEl.getAttribute('aria-label') || '';
        const placeholder = htmlEl.getAttribute('placeholder') || '';
        const currentValue = (htmlEl as HTMLInputElement).value || '';
        const type = htmlEl.getAttribute('type') || '';
        const classes = Array.from(htmlEl.classList);
        
        // Look for label text
        let labelText = '';
        // Check for explicit label
        if (id) {
          const labelEl = document.querySelector(`label[for="${id}"]`);
          if (labelEl) {
            labelText = labelEl.textContent?.trim() || '';
          }
        }
        
        // Check parent label
        if (!labelText) {
          let parent = htmlEl.parentElement;
          while (parent && !labelText) {
            if (parent.tagName === 'LABEL') {
              labelText = parent.textContent?.trim() || '';
            }
            parent = parent.parentElement;
          }
        }
        
        // Check for form question title within a section
        if (!labelText) {
          const formSection = htmlEl.closest('fieldset, [role="group"]');
          if (formSection) {
            const titleEl = formSection.querySelector('legend, [role="heading"]');
            if (titleEl) {
              labelText = titleEl.textContent?.trim() || '';
            }
          }
        }
        
        return {
          tagName,
          id,
          name,
          ariaLabel,
          placeholder,
          currentValue,
          type,
          classes,
          labelText,
          isFillable: tagName === 'input' || 
                      tagName === 'textarea' || 
                      tagName === 'select' || 
                      htmlEl.hasAttribute('contenteditable') ||
                      htmlEl.getAttribute('role') === 'textbox',
          isCustomOption: htmlEl.closest('[data-is-custom-option]') !== null ||
                        htmlEl.hasAttribute('aria-label') && htmlEl.getAttribute('aria-label') === 'Other response'
        };
      });
      
      // Log detailed element information for better debugging
      console.log(`Target element info:`, JSON.stringify(elementInfo, null, 2));
      
      // If this is an "Other" input field
      if (elementInfo.isCustomOption) {
        console.log('Handling custom option input field');
        await elementHandle.fill(value);
        this._trackInteractionWithDetails(
          'fill', 
          'type', 
          true, 
          selector, 
          {
            label: `${elementInfo.labelText || elementInfo.ariaLabel || 'Unknown field'} (Custom)`,
            type: 'custom-input',
            value
          }
        );
        return true;
      }
      
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
          this._trackInteractionWithDetails(
            'fill', 
            'type', 
            true, 
            `${selector} > input`, 
            {
              label: elementInfo.labelText || elementInfo.ariaLabel || elementInfo.placeholder || element.text,
              type: 'input',
              value
            }
          );
          
          // Provide feedback after interaction
          const feedbackAfterAction = await this.getInteractionContext();
          console.log(`Fill feedback for inner element:`, 
            JSON.stringify({
              url: feedbackAfterAction.currentState.url,
              title: feedbackAfterAction.currentState.title,
              filledFields: feedbackAfterAction.formData.filledFieldsCount,
              totalFields: feedbackAfterAction.formData.totalFieldsCount,
              lastAction: feedbackAfterAction.interactionHistory[feedbackAfterAction.interactionHistory.length - 1]
            }, null, 2)
          );
          
          return true;
        }
        
        this._trackInteractionWithDetails(
          'fill', 
          'type', 
          false, 
          selector, 
          {
            label: elementInfo.labelText || elementInfo.ariaLabel || elementInfo.placeholder || element.text,
            value
          }
        );
        return false;
      }
      
      // If the field already has a value, we should not overwrite it
      // Instead, look for the next appropriate field
      if (elementInfo.currentValue && elementInfo.currentValue.trim() !== '') {
        console.log(`Element already has value: "${elementInfo.currentValue}". Will find the next appropriate empty input...`);
        
        // Analyze the form structure
        const formSections = await this.page.evaluate(() => {
          // Look for form sections (fieldsets, divs with roles, etc)
          const sections = Array.from(document.querySelectorAll('fieldset, [role="group"], form > div'));
          
          return sections.map((section, index) => {
            // Find a title/label for this section
            const titleEl = section.querySelector('legend, [role="heading"], h1, h2, h3, h4, h5, h6');
            const title = titleEl ? titleEl.textContent?.trim() : '';
            
            // Check what kinds of inputs this section contains
            const hasTextInput = !!section.querySelector('input[type="text"], input[type="email"], textarea');
            const hasRadioOptions = !!section.querySelector('input[type="radio"], [role="radio"]');
            const hasCheckboxes = !!section.querySelector('input[type="checkbox"], [role="checkbox"]');
            
            // Check if any inputs in this section are already filled
            const hasFilledInputs = !!section.querySelector(
              'input[type="text"]:not([value=""]), input[type="email"]:not([value=""]), textarea:not(:empty)'
            );
            const hasCheckedOptions = !!section.querySelector(
              'input[type="radio"]:checked, [role="radio"][aria-checked="true"]'
            );
            
            return {
              index,
              title,
              isAnswered: hasFilledInputs || hasCheckedOptions,
              hasTextInput,
              hasRadioOptions,
              hasCheckboxes
            };
          });
        });
        
        console.log('Form sections:', JSON.stringify(formSections, null, 2));
        
        // Find the first unanswered section with a text input
        const nextSection = formSections.find(q => !q.isAnswered && q.hasTextInput);
        if (nextSection && nextSection.title) {
          console.log(`Found next unanswered section: "${nextSection.title}"`);
          // We'll continue with the generic approach below to find the next input
        }
        
        // Get all potential form input elements
        const inputs = await this.page.$$('input[type="text"], input[type="email"], input:not([type]), textarea, [contenteditable="true"]');
        
        // Log all available inputs for debugging
        const inputsInfo = await Promise.all(inputs.map(async (input, index) => {
          return input.evaluate((el, idx) => {
            const htmlEl = el as HTMLElement;
            // Find associated label
            let labelText = '';
            if (htmlEl.id) {
              const labelEl = document.querySelector(`label[for="${htmlEl.id}"]`);
              if (labelEl) labelText = labelEl.textContent?.trim() || '';
            }
            
            // Try parent label if no direct label
            if (!labelText) {
              let parent = htmlEl.parentElement;
              while (parent && !labelText) {
                if (parent.tagName === 'LABEL') {
                  labelText = parent.textContent?.trim() || '';
                }
                parent = parent.parentElement;
              }
            }
            
            // For form questions, try to get section title
            if (!labelText) {
              const formSection = htmlEl.closest('fieldset, [role="group"]');
              if (formSection) {
                const titleEl = formSection.querySelector('legend, [role="heading"]');
                if (titleEl) labelText = titleEl.textContent?.trim() || '';
              }
            }
            
            return {
              index: idx,
              id: htmlEl.id || '',
              name: htmlEl.getAttribute('name') || '',
              ariaLabel: htmlEl.getAttribute('aria-label') || '',
              placeholder: htmlEl.getAttribute('placeholder') || '',
              labelText,
              value: (htmlEl as HTMLInputElement).value || '',
              type: htmlEl.getAttribute('type') || 'text',
              isVisible: htmlEl.offsetWidth > 0 && htmlEl.offsetHeight > 0,
              boundingRect: htmlEl.getBoundingClientRect()
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
          this._trackInteractionWithDetails(
            'fill', 
            'type', 
            true, 
            nextInputSelector, 
            {
              label: nextInputInfo.labelText || nextInputInfo.ariaLabel || nextInputInfo.placeholder,
              type: nextInputInfo.type || 'text',
              name: nextInputInfo.name,
              id: nextInputInfo.id,
              value
            }
          );
          
          // Provide feedback after interaction
          const feedbackAfterAction = await this.getInteractionContext();
          console.log(`Fill feedback for next field:`, 
            JSON.stringify({
              url: feedbackAfterAction.currentState.url,
              title: feedbackAfterAction.currentState.title,
              filledFields: feedbackAfterAction.formData.filledFieldsCount,
              totalFields: feedbackAfterAction.formData.totalFieldsCount,
              recentAction: feedbackAfterAction.interactionHistory[feedbackAfterAction.interactionHistory.length - 1]
            }, null, 2)
          );
          
          return true;
        } else {
          console.warn(`Could not find a next empty input to fill with "${value}"`);
          this._trackInteractionWithDetails(
            'fill', 
            'type', 
            false, 
            selector, 
            {
              label: elementInfo.labelText || elementInfo.ariaLabel || elementInfo.placeholder,
              value
            }
          );
          return false;
        }
      }
      
      // If we reach here, it means our target element is fillable and empty
      await this.page.fill(selector, value);
      
      // Take screenshot after action for feedback
      const afterScreenshot = await this.takeScreenshot();
      console.log(`Successfully filled "${selector}" with "${value}"`);
      this._trackInteractionWithDetails(
        'fill', 
        'type', 
        true, 
        selector, 
        {
          label: elementInfo.labelText || elementInfo.ariaLabel || elementInfo.placeholder || element.text,
          type: elementInfo.type || 'text',
          name: elementInfo.name,
          id: elementInfo.id,
          value
        }
      );
      
      // Provide feedback after interaction
      const feedbackAfterAction = await this.getInteractionContext();
      console.log(`Fill feedback:`, 
        JSON.stringify({
          url: feedbackAfterAction.currentState.url,
          title: feedbackAfterAction.currentState.title,
          filledFields: feedbackAfterAction.formData.filledFieldsCount,
          totalFields: feedbackAfterAction.formData.totalFieldsCount,
          recentAction: feedbackAfterAction.interactionHistory[feedbackAfterAction.interactionHistory.length - 1]
        }, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Fill error:', error);
      
      // Take screenshot on error for feedback
      const errorScreenshot = await this.takeScreenshot();
      console.log(`Error screenshot taken after fill attempt failed`);
      this._trackInteractionWithDetails(
        'fill', 
        'type', 
        false, 
        this.buildSelector(element), 
        { value }
      );
      
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
        this._trackInteractionWithDetails('select', 'choose', false, selector, { value });
        return false;
      }
      
      // Get element details for better tracking
      const elementInfo = await elementHandle.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        return {
          tag: htmlEl.tagName.toLowerCase(),
          id: htmlEl.id || '',
          name: htmlEl.getAttribute('name') || '',
          ariaLabel: htmlEl.getAttribute('aria-label') || '',
          text: htmlEl.textContent?.trim() || '',
          placeholder: htmlEl.getAttribute('placeholder') || '',
          classes: Array.from(htmlEl.classList),
          type: htmlEl.getAttribute('type') || htmlEl.tagName.toLowerCase(),
          role: htmlEl.getAttribute('role') || ''
        };
      });
      
      // Check if it's a standard select element
      const isStandardSelect = await elementHandle.evaluate(el => {
        return (el as HTMLElement).tagName.toLowerCase() === 'select';
      });
      
      if (isStandardSelect) {
        await this.page.selectOption(selector, value);
        this._trackInteractionWithDetails(
          'select', 
          'choose', 
          true, 
          selector, 
          {
            label: elementInfo.ariaLabel || elementInfo.placeholder || element.text || elementInfo.text,
            type: 'select',
            name: elementInfo.name,
            id: elementInfo.id,
            value
          }
        );
        
        // Provide feedback after interaction
        const feedbackAfterAction = await this.getInteractionContext();
        console.log(`Select feedback:`, 
          JSON.stringify({
            url: feedbackAfterAction.currentState.url,
            title: feedbackAfterAction.currentState.title,
            selectedValue: value,
            currentInteractions: feedbackAfterAction.interactionHistory.slice(-3)
          }, null, 2)
        );
        
        return true;
      }
      
      // For radio buttons in a form
      const radioSelector = `[aria-label="${elementInfo.ariaLabel}"], [name="${elementInfo.name}"], [role="radio"]`;
      // Look for a radio option with the given value
      const optionLabelSelector = `${radioSelector} .label:has-text("${value}"), label:has-text("${value}")`;
      const optionValueSelector = `${radioSelector}[value="${value}"]`;
      
      const radioOption = await this.page.$(optionLabelSelector) || await this.page.$(optionValueSelector);
      if (radioOption) {
        await radioOption.click();
        this._trackInteractionWithDetails(
          'select', 
          'select', 
          true, 
          optionLabelSelector, 
          {
            label: elementInfo.ariaLabel || elementInfo.text || elementInfo.name,
            type: 'radio',
            value
          }
        );
        return true;
      }
      
      // Handle non-standard selects
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
        this._trackInteractionWithDetails(
          'select', 
          'choose', 
          true, 
          `${selector} > ${optionSelector}`, 
          {
            label: elementInfo.ariaLabel || elementInfo.placeholder || element.text || elementInfo.text,
            type: 'custom-select',
            name: elementInfo.name,
            id: elementInfo.id,
            value
          }
        );
        
        // Provide feedback after interaction
        const feedbackAfterAction = await this.getInteractionContext();
        console.log(`Custom select feedback:`, 
          JSON.stringify({
            url: feedbackAfterAction.currentState.url,
            title: feedbackAfterAction.currentState.title,
            selectedValue: value,
            currentInteractions: feedbackAfterAction.interactionHistory.slice(-3)
          }, null, 2)
        );
        
        return true;
      } catch (error) {
        console.warn(`Could not find option with text "${value}" in dropdown`);
        // If we can't find the option by text, try to find input element for "Other" option
        const otherInputSelector = `${selector} input, input[aria-label="Other response"]`;
        try {
          const otherInput = await this.page.$(otherInputSelector);
          if (otherInput) {
            await otherInput.fill(value);
            this._trackInteractionWithDetails(
              'fill', 
              'type', 
              true, 
              otherInputSelector, 
              {
                label: `${elementInfo.ariaLabel || elementInfo.placeholder || element.text || elementInfo.text} (Custom)`,
                type: 'custom-input',
                value
              }
            );
            return true;
          }
        } catch (inputError) {
          console.error('Failed to fill custom input:', inputError);
        }
        this._trackInteractionWithDetails(
          'select', 
          'choose', 
          false, 
          selector, 
          {
            label: elementInfo.ariaLabel || elementInfo.placeholder || element.text || elementInfo.text,
            type: 'custom-select',
            value
          }
        );
        return false;
      }
    } catch (error) {
      console.error('Select error:', error);
      this._trackInteractionWithDetails(
        'select', 
        'choose', 
        false, 
        this.buildSelector(element), 
        { value }
      );
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

  // Track interaction history for better context
  private _interactionHistory: {
    action: string;
    actionType: string; // fill, click, select, check
    targetElement: {
      selector: string;
      label?: string;
      type?: string;
      name?: string;
      id?: string;
    };
    value?: string;
    success: boolean;
    timestamp: number;
    feedbackData?: any;
  }[] = [];
  
  /**
   * Update the interaction history with details
   */
  private _trackInteractionWithDetails(
    action: string, 
    actionType: string,
    success: boolean, 
    selector: string, 
    details: {
      label?: string;
      type?: string;
      name?: string;
      id?: string;
      value?: string;
      feedbackData?: any;
    } = {}
  ): void {
    // Update the last interaction tracker
    this._lastInteraction = {
      action,
      success,
      selector,
      timestamp: Date.now()
    };
    
    // Add to history with more details
    this._interactionHistory.push({
      action,
      actionType,
      targetElement: {
        selector,
        label: details.label,
        type: details.type,
        name: details.name,
        id: details.id
      },
      value: details.value,
      success,
      timestamp: Date.now(),
      feedbackData: details.feedbackData
    });
    
    // Keep history at a reasonable size (last 10 interactions)
    if (this._interactionHistory.length > 10) {
      this._interactionHistory.shift();
    }
    
    // Log the interaction for debugging
    console.log(`[Interaction] ${actionType} "${action}" on ${selector}${details.value ? ` with value "${details.value}"` : ''}: ${success ? 'SUCCESS' : 'FAILED'}`);
  }
  
  /**
   * Get a summary of recent interactions to provide context to the LLM
   */
  async getInteractionContext(): Promise<{
    currentState: {
      url: string;
      title: string;
      screenshot: string;
    };
    formData: {
      visibleFields: {
        fieldIndex: number;
        fieldType: string;
        label: string;
        name: string;
        id: string;
        value: string;
        isFilled: boolean;
        placeholder: string;
        position: {x: number, y: number};
      }[];
      filledFieldsCount: number;
      totalFieldsCount: number;
      currentFocusedField?: string;
    };
    interactionHistory: {
      sequence: number;
      actionType: string;
      action: string;
      target: string;
      value?: string;
      success: boolean;
      timestamp: string;
    }[];
    suggestedNextAction?: {
      actionType: string;
      targetFieldLabel?: string;
      targetFieldType?: string;
    };
  }> {
    // Get current page state
    const screenshot = await this.takeScreenshot();
    const url = this.page.url();
    const title = await this.page.title();
    
    // Get form feedback to analyze current form state
    const formFeedback = await this.getFormFeedback();
    
    // Process form elements into a more concise format
    const visibleFields = formFeedback.formElements.map((field, index) => ({
      fieldIndex: index,
      fieldType: field.type,
      label: field.label || field.ariaLabel || field.placeholder || '',
      name: field.name,
      id: field.id,
      value: field.value,
      isFilled: field.isFilled,
      placeholder: field.placeholder,
      position: {x: field.rect.x, y: field.rect.y}
    }));
    
    // Find the current focused field if any
    const focusedField = await this.page.evaluate(() => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName) {
        return {
          tagName: activeElement.tagName.toLowerCase(),
          id: (activeElement as HTMLElement).id || '',
          name: (activeElement as HTMLElement).getAttribute('name') || '',
          type: (activeElement as HTMLElement).getAttribute('type') || '',
          value: (activeElement instanceof HTMLInputElement) ? (activeElement as HTMLInputElement).value : ''
        };
      }
      return null;
    });
    
    // Format interaction history for LLM consumption
    const formattedHistory = this._interactionHistory.map((item, index) => ({
      sequence: index + 1,
      actionType: item.actionType,
      action: item.action,
      target: item.targetElement.label || item.targetElement.selector,
      value: item.value,
      success: item.success,
      timestamp: new Date(item.timestamp).toISOString()
    }));
    
    // Generate a suggested next action based on form state and history
    let suggestedNextAction: { actionType: string; targetFieldLabel?: string; targetFieldType?: string } | undefined;
    
    // Find the first empty required field
    const nextEmptyField = visibleFields.find(field => !field.isFilled);
    if (nextEmptyField) {
      // Determine appropriate action type based on field type
      let actionType = 'type';
      if (nextEmptyField.fieldType === 'radio' || nextEmptyField.fieldType === 'checkbox') {
        actionType = 'select';
      } else if (nextEmptyField.fieldType === 'select-one' || nextEmptyField.fieldType === 'select') {
        actionType = 'choose';
      }
      
      suggestedNextAction = {
        actionType,
        targetFieldLabel: nextEmptyField.label,
        targetFieldType: nextEmptyField.fieldType
      };
    }
    
    return {
      currentState: {
        url,
        title,
        screenshot
      },
      formData: {
        visibleFields,
        filledFieldsCount: visibleFields.filter(f => f.isFilled).length,
        totalFieldsCount: visibleFields.length,
        currentFocusedField: focusedField ? 
          `${focusedField.tagName}${focusedField.id ? `#${focusedField.id}` : ''}${focusedField.name ? `[name="${focusedField.name}"]` : ''}` : 
          undefined
      },
      interactionHistory: formattedHistory,
      suggestedNextAction
    };
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
    interactionHistory: {
      sequence: number;
      action: string;
      target: string;
      value?: string;
      success: boolean;
    }[];
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
          
          // For form sections, try to find the question/section title
          const formSection = el.closest('fieldset, [role="group"]');
          if (formSection) {
            const titleEl = formSection.querySelector('legend, [role="heading"]');
            if (titleEl && titleEl.textContent) {
              return titleEl.textContent.trim();
            }
          }
          
          return '';
        };
        
        // Find all form inputs, textareas, and selects
        const elements = Array.from(document.querySelectorAll(
          'input:not([type="hidden"]), textarea, select, [contenteditable="true"], [role="textbox"], [role="radio"], [role="checkbox"]'
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
          } else if (htmlEl.getAttribute('role') === 'radio' || htmlEl.getAttribute('role') === 'checkbox') {
            // For ARIA role-based inputs
            value = htmlEl.getAttribute('aria-checked') === 'true' ? 'true' : '';
            
            // Also try to get the option text for radios/checkboxes
            const label = htmlEl.querySelector('.label, label');
            if (label && label.textContent) {
              value = label.textContent.trim();
            }
          }
          
          // Get other attributes
          const id = htmlEl.id || '';
          const name = htmlEl.getAttribute('name') || '';
          let type = htmlEl instanceof HTMLInputElement ? 
                    htmlEl.type : 
                    htmlEl.tagName.toLowerCase();
                    
          // For role-based inputs
          if (htmlEl.getAttribute('role') === 'radio') {
            type = 'radio';
          } else if (htmlEl.getAttribute('role') === 'checkbox') {
            type = 'checkbox';
          }
          
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
      
      // Format interaction history
      const formattedHistory = this._interactionHistory.map((item, index) => ({
        sequence: index + 1,
        action: item.action,
        target: item.targetElement.label || item.targetElement.selector,
        value: item.value,
        success: item.success
      }));
      
      // Log the form state for debugging
      console.log('Form feedback:', {
        url,
        title,
        formElementsCount: sortedFormElements.length,
        filledElements: sortedFormElements.filter(el => el.isFilled).length,
        interactionHistoryLength: formattedHistory.length
      });
      
      // Return structured data for LLM
      return {
        screenshot,
        url,
        title,
        formElements: sortedFormElements,
        lastInteractionResult: this._lastInteraction || null,
        interactionHistory: formattedHistory
      };
    } catch (error) {
      console.error('Get form feedback error:', error);
      return {
        screenshot: '',
        url: this.page.url(),
        title: '',
        formElements: [],
        lastInteractionResult: null,
        interactionHistory: []
      };
    }
  }
} 