/**
 * API Request Types
 */
import { InteractableElement } from './interactions/BaseDOMInteractor';

export interface TestWebsiteRequest {
  url: string;
  customSteps?: string[];
  options?: {
    timeout?: number;
    screenshotCapture?: boolean;
  };
}

// Keeping old type for backwards compatibility
export interface TestBookingFlowRequest extends TestWebsiteRequest {}

/**
 * Test Step Data
 */
export interface TestStep {
  name: string;
  status: "success" | "failure" | "running";
  duration?: number;
  screenshot?: string;
  error?: string;
  llmDecision?: LLMDecision;
}

/**
 * Test Error Data
 */
export interface TestError {
  step: string;
  message: string;
  details?: string;
}

/**
 * API Response Types
 */
export interface TestWebsiteResponse {
  success: boolean;
  testId: string;
  url: string;
  primaryCTAFound: boolean;
  interactionSuccessful: boolean;
  steps: TestStep[];
  totalDuration: number;
  errors: TestError[];
  customStepsResults?: CustomStepResult[];
}

// Keeping old type for backwards compatibility
export interface TestBookingFlowResponse extends Omit<TestWebsiteResponse, 'primaryCTAFound' | 'interactionSuccessful'> {
  demoFlowFound: boolean;
  bookingSuccessful: boolean;
}

/**
 * Test Status Response
 */
export interface TestStatusResponse {
  testId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  result?: TestWebsiteResponse | TestBookingFlowResponse;
  error?: string;
}

/**
 * Test History Item
 */
export interface TestHistoryItem {
  id: string;
  url: string;
  timestamp: string;
  success: boolean;
  primaryCTAFound?: boolean;
  interactionSuccessful?: boolean;
  demoFlowFound?: boolean;
  bookingSuccessful?: boolean;
}

/**
 * LLM Types
 */

export interface PageElement {
  tag: string;
  type?: string;
  id?: string;
  classes?: string[];
  text?: string;
  placeholder?: string;
  name?: string;
  href?: string;
  visible: boolean;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PageState {
  title: string;
  url: string;
  screenshot: string;
  elements: PageElement[];
  timestamp: string;
  availableTabs?: string[]; // List of available tabs/pages
  visualContext?: string; // Base64 encoded screenshot for visual context
  lastActionResult?: {
    action: string;
    success: boolean;
    error?: string;
    targetElementFound: boolean;
  };
  visibleElements?: InteractableElement[]; // Additional context for element selection
}

export interface LLMDecision {
  action: 'click' | 'type' | 'select' | 'wait' | 'verify' | 'submit' | 'hover' | 'check' | 'press' | 'switchTab';
  targetElement?: PageElement;
  value?: string;
  confidence: number;
  reasoning: string;
  explanation?: string;
  isComplete?: boolean;
  success?: boolean;
  error?: string;
  targetElementFound?: boolean;
  failureScreenshot?: string;
  successScreenshot?: string;
}

export interface ElementSelection {
  elementId: string;
  confidence: number;
  reasoning: string;
}

export interface FormFieldIdentification {
  fieldType: 'name' | 'email' | 'phone' | 'company' | 'message' | 'job-title' | 'other';
  valueToUse: string;
  confidence: number;
}

export interface CustomStepResult {
  instruction?: string;
  isComplete: boolean;
  isSuccess: boolean;
  screenshot?: string;
  decision?: LLMDecision;
  error?: string;
  status?: "success" | "failure" | "running";
} 