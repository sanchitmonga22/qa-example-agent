import { CustomStepResult, TestWebsiteResponse, TestHistoryItem, TestStatusResponse } from '../types';

/**
 * Service for managing test results
 * In a real application, this would use a database
 */
export class TestResultService {
  private static instance: TestResultService;
  private testStatuses: Map<string, TestStatusResponse> = new Map();
  private testHistories: Map<string, TestHistoryItem> = new Map();

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): TestResultService {
    if (!TestResultService.instance) {
      TestResultService.instance = new TestResultService();
    }
    return TestResultService.instance;
  }

  /**
   * Create a new pending test
   */
  public createPendingTest(testId: string): TestStatusResponse {
    const testStatus: TestStatusResponse = {
      testId,
      status: 'pending',
      progress: 0
    };

    this.testStatuses.set(testId, testStatus);
    return testStatus;
  }

  /**
   * Update a test to running status
   */
  public updateTestToRunning(testId: string): TestStatusResponse | null {
    const testStatus = this.testStatuses.get(testId);
    if (!testStatus) return null;

    testStatus.status = 'running';
    testStatus.progress = 25;
    this.testStatuses.set(testId, testStatus);

    return testStatus;
  }

  /**
   * Update test progress
   */
  public updateTestProgress(testId: string, progress: number): TestStatusResponse | null {
    const testStatus = this.testStatuses.get(testId);
    if (!testStatus) return null;

    testStatus.progress = Math.min(99, progress); // Cap at 99% until complete
    this.testStatuses.set(testId, testStatus);

    return testStatus;
  }

  /**
   * Update test with custom step result
   */
  public updateTestWithCustomStepResult(
    testId: string, 
    customStepResult: CustomStepResult
  ): TestStatusResponse | null {
    const testStatus = this.testStatuses.get(testId);
    if (!testStatus) return null;

    if (!testStatus.result) {
      testStatus.result = {
        testId,
        url: '',
        success: false,
        primaryCTAFound: false,
        interactionSuccessful: false,
        steps: [],
        totalDuration: 0,
        errors: []
      };
    }

    if (testStatus.result.customStepsResults) {
      testStatus.result.customStepsResults.push(customStepResult);
    } else {
      testStatus.result.customStepsResults = [customStepResult];
    }

    // Update progress based on step completion
    // If we have custom steps, calculate progress based on number completed
    const totalSteps = testStatus.result.customStepsResults.length;
    const progress = Math.min(25 + Math.floor((totalSteps / (totalSteps + 1)) * 74), 99);
    testStatus.progress = progress;

    this.testStatuses.set(testId, testStatus);
    return testStatus;
  }

  /**
   * Complete a test with results
   */
  public completeTest(result: TestWebsiteResponse): TestStatusResponse {
    const testStatus: TestStatusResponse = {
      testId: result.testId,
      status: 'completed',
      progress: 100,
      result
    };

    this.testStatuses.set(result.testId, testStatus);

    // Create history item
    const historyItem: TestHistoryItem = {
      id: result.testId,
      url: result.url,
      timestamp: new Date().toISOString(),
      success: result.success,
      primaryCTAFound: result.primaryCTAFound,
      interactionSuccessful: result.interactionSuccessful
    };

    // Ensure we're storing it properly
    this.testHistories.set(result.testId, historyItem);
    
    // Debug log to verify history is being saved
    console.log(`Test history saved for ID: ${result.testId}, Total history items: ${this.testHistories.size}`);
    
    return testStatus;
  }

  /**
   * Mark a test as failed
   */
  public failTest(testId: string, error: string): TestStatusResponse {
    const testStatus: TestStatusResponse = {
      testId,
      status: 'failed',
      error,
      progress: 100 // Mark as fully complete but failed
    };

    this.testStatuses.set(testId, testStatus);
    
    // Also add to history when a test fails
    const historyItem: TestHistoryItem = {
      id: testId,
      url: this.testStatuses.get(testId)?.result?.url || 'unknown',
      timestamp: new Date().toISOString(),
      success: false,
      primaryCTAFound: false,
      interactionSuccessful: false,
      error: error
    };
    
    this.testHistories.set(testId, historyItem);
    
    return testStatus;
  }

  /**
   * Get test status by ID
   */
  public getTestStatus(testId: string): TestStatusResponse | null {
    return this.testStatuses.get(testId) || null;
  }

  /**
   * Get all test history items
   */
  public getAllTestHistory(): TestHistoryItem[] {
    // Convert the Map values to an array and sort by timestamp
    const historyItems = Array.from(this.testHistories.values());
    
    // Debug log to check if we have history items
    console.log(`Getting all test history. Total items: ${historyItems.length}`);
    
    return historyItems.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get test history by ID
   */
  public getTestHistoryById(id: string): TestHistoryItem | null {
    return this.testHistories.get(id) || null;
  }
  
  /**
   * Clear all history (for testing purposes)
   */
  public clearHistory(): void {
    this.testHistories.clear();
    this.testStatuses.clear();
  }
} 