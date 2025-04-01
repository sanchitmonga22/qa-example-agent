import { NextRequest, NextResponse } from 'next/server';
import { WebSiteTest } from '@/lib/playwright/WebSiteTest';
import { TestWebsiteRequest, TestWebsiteResponse } from '@/lib/types';
import { TestResultService } from '@/lib/services/TestResultService';
import { z } from 'zod';
import { generateTestId } from '@/lib/utils';

// Validation schema for the request
const requestSchema = z.object({
  url: z.string().url({ message: "Invalid URL format" }),
  customSteps: z.array(z.string()).optional(),
  options: z.object({
    timeout: z.number().min(5000).max(120000).optional(),
    screenshotCapture: z.boolean().optional(),
    headless: z.boolean().optional()
  }).optional()
});

/**
 * API Route for testing website interactions
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Validate the request
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid request", 
          details: validationResult.error.errors 
        }, 
        { status: 400 }
      );
    }
    
    const testRequest: TestWebsiteRequest = validationResult.data;
    
    // Run the test
    const tester = new WebSiteTest(testRequest);
    
    // If custom steps are provided, use them in the test
    const result: TestWebsiteResponse = await tester.runTestWithCustomSteps(testRequest.url, testRequest.customSteps || []);
    
    // Save result to test history service
    const testResultService = TestResultService.getInstance();
    testResultService.completeTest(result);
    
    // Log success for debugging
    console.log(`Test completed successfully. Test ID: ${result.testId}, History updated.`);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing website interaction:', error);
    
    // If we have an error, try to record the failure
    try {
      const testId = generateTestId();
      const testResultService = TestResultService.getInstance();
      testResultService.failTest(testId, error instanceof Error ? error.message : String(error));
    } catch (recordError) {
      console.error('Failed to record test failure:', recordError);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to run test", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 