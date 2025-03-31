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

    testStatus.progress = progress;
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

    this.testHistories.set(result.testId, historyItem);
    return testStatus;
  }

  /**
   * Mark a test as failed
   */
  public failTest(testId: string, error: string): TestStatusResponse {
    const testStatus: TestStatusResponse = {
      testId,
      status: 'failed',
      error
    };

    this.testStatuses.set(testId, testStatus);
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
    return Array.from(this.testHistories.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get test history by ID
   */
  public getTestHistoryById(id: string): TestHistoryItem | null {
    return this.testHistories.get(id) || null;
  }
} 