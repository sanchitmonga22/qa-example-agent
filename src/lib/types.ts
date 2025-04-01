/**
 * API Request Types
 */
export interface TestWebsiteRequest {
  url: string;
  customSteps?: string[];
  options?: TestWebsiteOptions;
}

export interface TestWebsiteOptions {
  timeout?: number;
  screenshotCapture?: boolean;
  headless?: boolean;
  detailedLogging?: boolean;
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
  error?: string;
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
}

export interface LLMDecision {
  action: 'click' | 'type' | 'select' | 'wait' | 'verify' | 'submit' | 'hover' | 'check' | 'press' | 'switchTab';
  targetElement?: PageElement;
  value?: string;
  confidence: number;
  reasoning: string;
  explanation?: string;
  isComplete?: boolean;
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

export interface VisionAnalysisResult {
  isPassed: boolean;
  confidence: number;
  reasoning: string;
  beforeScreenshot?: string;
  afterScreenshot?: string;
}

export interface CustomStepResult {
  instruction: string;
  success: boolean;
  screenshot?: string;
  llmDecision?: LLMDecision;
  error?: string;
  status?: "success" | "failure" | "running";
  visionAnalysis?: VisionAnalysisResult;
} 