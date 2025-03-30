import { NextRequest, NextResponse } from 'next/server';
import { TestResultService } from '@/lib/services/TestResultService';

/**
 * API Route for getting test history
 */
export async function GET(request: NextRequest) {
  try {
    const testResultService = TestResultService.getInstance();
    const history = testResultService.getAllTestHistory();
    
    return NextResponse.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Error fetching test history:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch test history", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 