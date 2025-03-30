/**
 * API Request Types
 */
export interface TestBookingFlowRequest {
  url: string;
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
  demoFlowFound: boolean;
  bookingSuccessful: boolean;
  steps: TestStep[];
  totalDuration: number;
  errors: TestError[];
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