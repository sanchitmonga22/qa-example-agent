import { NextRequest, NextResponse } from 'next/server';
import { TestResultService } from '@/lib/services/TestResultService';

/**
 * API Route for getting a specific test history item
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
    
    const testResultService = TestResultService.getInstance();
    const historyItem = testResultService.getTestHistoryById(testId);
    
    if (!historyItem) {
      return NextResponse.json(
        { success: false, error: "Test history not found" }, 
        { status: 404 }
      );
    }
    
    // Get the full test result for this history item
    const testStatus = testResultService.getTestStatus(testId);
    
    return NextResponse.json({
      success: true,
      historyItem,
      testResult: testStatus?.result || null
    });
  } catch (error) {
    console.error('Error fetching test history item:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch test history item", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 