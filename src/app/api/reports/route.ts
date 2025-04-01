import { NextRequest, NextResponse } from 'next/server';
import { TestResultService } from '@/lib/services/TestResultService';

/**
 * API Route for generating and retrieving reports
 */
export async function GET(request: NextRequest) {
  try {
    const testResultService = TestResultService.getInstance();
    const history = testResultService.getAllTestHistory();
    
    // Generate a report with statistics
    const totalTests = history.length;
    const successfulTests = history.filter(item => item.success).length;
    const failedTests = totalTests - successfulTests;
    const successRate = totalTests > 0 ? Math.round((successfulTests / totalTests) * 100) : 0;
    
    // Group by URL domain
    const urlGroups = history.reduce((groups, item) => {
      try {
        const url = new URL(item.url);
        const domain = url.hostname;
        
        if (!groups[domain]) {
          groups[domain] = {
            domain,
            totalTests: 0,
            successfulTests: 0,
            failedTests: 0
          };
        }
        
        groups[domain].totalTests++;
        if (item.success) {
          groups[domain].successfulTests++;
        } else {
          groups[domain].failedTests++;
        }
        
        return groups;
      } catch (e) {
        // Handle invalid URLs
        return groups;
      }
    }, {} as Record<string, any>);
    
    const domainStats = Object.values(urlGroups);
    
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalTests,
        successfulTests,
        failedTests,
        successRate
      },
      domainStats,
      recentTests: history.slice(0, 10) // Latest 10 tests
    };
    
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate report", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 