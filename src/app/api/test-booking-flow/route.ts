import { NextRequest, NextResponse } from 'next/server';
import { BookingFlowTest } from '@/lib/playwright/BookingFlowTest';
import { TestBookingFlowRequest, TestBookingFlowResponse } from '@/lib/types';
import { TestResultService } from '@/lib/services/TestResultService';
import { z } from 'zod';

// Validation schema for the request
const requestSchema = z.object({
  url: z.string().url({ message: "Invalid URL format" }),
  customSteps: z.array(z.string()).optional(),
  options: z.object({
    timeout: z.number().min(5000).max(120000).optional(),
    screenshotCapture: z.boolean().optional()
  }).optional()
});

/**
 * API Route for testing booking flows
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
    
    const testRequest: TestBookingFlowRequest = validationResult.data;
    
    // Run the test
    const tester = new BookingFlowTest(testRequest);
    
    // If custom steps are provided, use them in the test
    const result: TestBookingFlowResponse = testRequest.customSteps && testRequest.customSteps.length > 0
      ? await tester.runTestWithCustomSteps(testRequest.url, testRequest.customSteps)
      : await tester.runTest(testRequest.url);
    
    // Save result to test history service
    const testResultService = TestResultService.getInstance();
    testResultService.completeTest(result);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error testing booking flow:', error);
    
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