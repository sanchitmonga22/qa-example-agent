import { NextRequest, NextResponse } from 'next/server';
import { TestResultService } from '@/lib/services/TestResultService';

/**
 * API Route for retrieving specific test report by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const testId = params.id;
    
    if (!testId) {
      return NextResponse.json(
        { success: false, error: "Missing test ID" },
        { status: 400 }
      );
    }
    
    const testResultService = TestResultService.getInstance();
    const historyItem = testResultService.getTestHistoryById(testId);
    const testStatus = testResultService.getTestStatus(testId);
    
    if (!historyItem) {
      return NextResponse.json(
        { success: false, error: "Test report not found" },
        { status: 404 }
      );
    }
    
    // Determine output format based on query param
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';
    
    const report = {
      id: historyItem.id,
      url: historyItem.url,
      timestamp: historyItem.timestamp,
      success: historyItem.success,
      primaryCTAFound: historyItem.primaryCTAFound,
      interactionSuccessful: historyItem.interactionSuccessful,
      error: historyItem.error,
      details: testStatus?.result || null,
      executionTime: testStatus?.result ? 
        `${Math.round(testStatus.result.totalDuration / 1000)}s` : 'Unknown'
    };
    
    // Handle different output formats
    switch (format.toLowerCase()) {
      case 'html':
        // Simple HTML report
        const html = generateHtmlReport(report);
        return new NextResponse(html, {
          headers: {
            'Content-Type': 'text/html'
          }
        });
        
      case 'csv':
        // Simple CSV format
        const csv = `"ID","URL","Timestamp","Success","Primary CTA Found","Interaction Successful","Error"
"${report.id}","${report.url}","${report.timestamp}","${report.success}","${report.primaryCTAFound}","${report.interactionSuccessful}","${report.error || ''}"`
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="report-${report.id}.csv"`
          }
        });
        
      case 'json':
      default:
        return NextResponse.json(report);
    }
  } catch (error) {
    console.error('Error retrieving test report:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to retrieve test report", 
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}

/**
 * Generate a simple HTML report
 */
function generateHtmlReport(report: any): string {
  const stepsHtml = report.details?.steps?.map((step: any) => `
    <div class="step">
      <h3>${step.name} - ${step.status}</h3>
      ${step.duration ? `<p>Duration: ${Math.round(step.duration)}ms</p>` : ''}
      ${step.error ? `<p class="error">Error: ${step.error}</p>` : ''}
      ${step.screenshot ? `<img src="data:image/png;base64,${step.screenshot}" alt="Step screenshot" />` : ''}
    </div>
  `).join('') || '';
  
  const customStepsHtml = report.details?.customStepsResults?.map((step: any) => `
    <div class="step">
      <h3>${step.instruction} - ${step.status}</h3>
      ${step.error ? `<p class="error">Error: ${step.error}</p>` : ''}
      ${step.screenshot ? `<img src="data:image/png;base64,${step.screenshot}" alt="Step screenshot" />` : ''}
    </div>
  `).join('') || '';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report: ${report.id}</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 1rem; }
    h1, h2 { color: #333; }
    .success { color: green; }
    .failure { color: red; }
    .error { color: red; font-weight: bold; }
    .step { margin-bottom: 1rem; border: 1px solid #eee; padding: 1rem; border-radius: 4px; }
    .step img { max-width: 100%; border: 1px solid #ccc; border-radius: 4px; margin-top: 0.5rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .stat-card { background: #f9f9f9; padding: 1rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Test Report: ${report.id}</h1>
  <p>Generated at: ${new Date().toLocaleString()}</p>
  
  <div class="stats">
    <div class="stat-card">
      <h3>Status</h3>
      <p class="${report.success ? 'success' : 'failure'}">${report.success ? 'Success' : 'Failure'}</p>
    </div>
    <div class="stat-card">
      <h3>URL</h3>
      <p><a href="${report.url}" target="_blank">${report.url}</a></p>
    </div>
    <div class="stat-card">
      <h3>Timestamp</h3>
      <p>${new Date(report.timestamp).toLocaleString()}</p>
    </div>
    <div class="stat-card">
      <h3>Execution Time</h3>
      <p>${report.executionTime}</p>
    </div>
    <div class="stat-card">
      <h3>Primary CTA Found</h3>
      <p class="${report.primaryCTAFound ? 'success' : 'failure'}">${report.primaryCTAFound ? 'Yes' : 'No'}</p>
    </div>
    <div class="stat-card">
      <h3>Interaction Successful</h3>
      <p class="${report.interactionSuccessful ? 'success' : 'failure'}">${report.interactionSuccessful ? 'Yes' : 'No'}</p>
    </div>
  </div>
  
  ${report.error ? `<div class="error-section">
    <h2>Error</h2>
    <p class="error">${report.error}</p>
  </div>` : ''}
  
  ${stepsHtml ? `<h2>Test Steps</h2>${stepsHtml}` : ''}
  ${customStepsHtml ? `<h2>Custom Steps</h2>${customStepsHtml}` : ''}
</body>
</html>`;
} 