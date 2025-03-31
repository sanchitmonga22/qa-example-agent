/**
 * API Request Types
 */
export interface TestBookingFlowRequest {
  url: string;
  customSteps?: string[];
  options?: {
    timeout?: number;
    screenshotCapture?: boolean;
  };
}

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
export interface TestBookingFlowResponse {
  success: boolean;
  testId: string;
  url: string;
  demoFlowFound: boolean;
  bookingSuccessful: boolean;
  steps: TestStep[];
  totalDuration: number;
  errors: TestError[];
  customStepsResults?: CustomStepResult[];
}

/**
 * Test Status Response
 */
export interface TestStatusResponse {
  testId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  result?: TestBookingFlowResponse;
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
  demoFlowFound: boolean;
  bookingSuccessful: boolean;
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
}

export interface LLMDecision {
  action: 'click' | 'type' | 'select' | 'wait' | 'verify' | 'submit' | 'hover' | 'check' | 'press';
  targetElement?: PageElement;
  value?: string;
  confidence: number;
  reasoning: string;
  explanation?: string;
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
  instruction: string;
  success: boolean;
  screenshot?: string;
  llmDecision?: LLMDecision;
  error?: string;
  status?: "success" | "failure" | "running";
} 