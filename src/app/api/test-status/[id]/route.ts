import { NextRequest, NextResponse } from 'next/server';
import { TestResultService } from '@/lib/services/TestResultService';

/**
 * API Route for getting the status of a test
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const testId = params.id;
    
    if (!testId) {
      return NextResponse.json(
        { success: false, error: "Test ID is required" }, 
        { status: 400 }
      );
    }
    
    // Get test status from the service
    const testResultService = TestResultService.getInstance();
    const testStatus = testResultService.getTestStatus(testId);
    
    if (!testStatus) {
      return NextResponse.json(
        { success: false, error: "Test not found" }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json(testStatus);
  } catch (error) {
    console.error('Error fetching test status:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch test status", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 