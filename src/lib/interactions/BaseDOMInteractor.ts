/**
 * Base abstract class defining all possible DOM interactions
 * This class serves as a contract for all DOM interaction implementations
 */
export abstract class BaseDOMInteractor {
  /**
   * Navigate to a URL
   */
  abstract navigate(url: string, options?: NavigationOptions): Promise<boolean>;
  
  /**
   * Click on an element
   */
  abstract click(element: InteractableElement): Promise<boolean>;
  
  /**
   * Fill a form field
   */
  abstract fill(element: InteractableElement, value: string): Promise<boolean>;
  
  /**
   * Select an option from a dropdown
   */
  abstract select(element: InteractableElement, value: string): Promise<boolean>;
  
  /**
   * Check or uncheck a checkbox
   */
  abstract check(element: InteractableElement, state?: boolean): Promise<boolean>;
  
  /**
   * Press a key
   */
  abstract pressKey(key: string): Promise<boolean>;
  
  /**
   * Hover over an element
   */
  abstract hover(element: InteractableElement): Promise<boolean>;
  
  /**
   * Wait for element to be visible
   */
  abstract waitForElement(element: InteractableElement, options?: WaitOptions): Promise<boolean>;
  
  /**
   * Wait for navigation to complete
   */
  abstract waitForNavigation(options?: WaitOptions): Promise<boolean>;
  
  /**
   * Get text content of an element
   */
  abstract getText(element: InteractableElement): Promise<string>;
  
  /**
   * Get value of an input element
   */
  abstract getValue(element: InteractableElement): Promise<string>;
  
  /**
   * Check if element exists
   */
  abstract exists(element: InteractableElement): Promise<boolean>;
  
  /**
   * Check if element is visible
   */
  abstract isVisible(element: InteractableElement): Promise<boolean>;
  
  /**
   * Get current page title
   */
  abstract getPageTitle(): Promise<string>;
  
  /**
   * Get current page URL
   */
  abstract getPageUrl(): Promise<string>;
  
  /**
   * Take a screenshot
   */
  abstract takeScreenshot(): Promise<string>;
  
  /**
   * Get all interactable elements on the page
   */
  abstract getInteractableElements(): Promise<InteractableElement[]>;
  
  /**
   * Submit a form
   */
  abstract submitForm(formElement?: InteractableElement): Promise<boolean>;
  
  /**
   * Scroll element into view
   */
  abstract scrollIntoView(element: InteractableElement): Promise<boolean>;
  
  /**
   * Execute custom JavaScript in the page context
   */
  abstract evaluate<T>(fn: () => T): Promise<T>;
}

/**
 * Represents an element that can be interacted with
 */
export interface InteractableElement {
  tag?: string;
  id?: string;
  classes?: string[];
  text?: string;
  selector?: string;
  xpath?: string;
  attributes?: Record<string, string | undefined>;
  index?: number;
  rect?: ElementRect;
}

/**
 * Rectangle coordinates and dimensions of an element
 */
export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Options for navigation
 */
export interface NavigationOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

/**
 * Options for waiting
 */
export interface WaitOptions {
  timeout?: number;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
} 