import { TestWebsiteResponse, TestError, TestStep, CustomStepResult, LLMFeedback } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { parseLLMFeedback } from './utils';

// Helper function to sanitize and validate base64 data
export const getValidImageUrl = (base64Data?: string): string => {
  if (!base64Data || base64Data.trim() === '') {
    return '';
  }
  
  // Ensure the base64 data doesn't already have the data:image prefix
  if (base64Data.startsWith('data:image/')) {
    return base64Data;
  }
  
  // Otherwise, add the proper prefix
  return `data:image/png;base64,${base64Data.trim()}`;
};

// Helper to check if a screenshot is valid
export const isValidScreenshot = (screenshot?: string): boolean => {
  return !!screenshot && screenshot.trim() !== '';
};

/**
 * Calculate test metrics from test results
 */
export const calculateTestMetrics = (results: TestWebsiteResponse) => {
  // Determine if we're using custom steps or regular steps
  const hasCustomSteps = results.customStepsResults && results.customStepsResults.length > 0;
  
  if (hasCustomSteps) {
    const totalTests = results.customStepsResults!.length;
    const passedTests = results.customStepsResults!.filter(step => step.success).length;
    const failedTests = totalTests - passedTests;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      passRate
    };
  } else {
    const totalTests = results.steps.length;
    const passedTests = results.steps.filter(step => step.status === "success").length;
    const failedTests = results.steps.filter(step => step.status === "failure").length;
    const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;
    
    return {
      totalTests,
      passedTests,
      failedTests,
      passRate
    };
  }
};

export const generateTestResultsPDF = async (
  results: TestWebsiteResponse, 
  reportElement: HTMLElement,
  onStart: () => void,
  onSuccess: () => void,
  onError: (error: any) => void
) => {
  try {
    // Import libraries dynamically to reduce initial bundle size
    const [jsPDF, html2canvas] = await Promise.all([
      import('jspdf').then(module => module.default),
      import('html2canvas').then(module => module.default)
    ]);
    
    if (!reportElement) return;
    
    onStart();
    
    const content = reportElement;
    
    // First, expand all the accordions for the PDF
    const accordionTriggers = content.querySelectorAll('.accordion-trigger');
    const originalStates: boolean[] = [];
    
    accordionTriggers.forEach((trigger) => {
      const expanded = trigger.getAttribute('data-state') === 'open';
      originalStates.push(expanded);
      if (!expanded) {
        (trigger as HTMLElement).click();
      }
    });
    
    // Create a new PDF with A4 dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 10; // margin in mm
    const contentWidth = pageWidth - (margin * 2);
    
    // Add title
    pdf.setFontSize(16);
    pdf.text("Test Results Report", margin, margin + 10);
    
    // Add test info
    pdf.setFontSize(10);
    const testInfo = `URL: ${results.url} • Test ID: ${results.testId} • Duration: ${formatDuration(results.totalDuration)}`;
    pdf.text(testInfo, margin, margin + 20);
    
    // Add result status
    pdf.setFontSize(12);
    const status = results.success ? "PASSED" : "FAILED";
    pdf.text(`Test Status: ${status}`, margin, margin + 30);
    
    // Add primary results
    pdf.text(`CTA Detection: ${results.primaryCTAFound ? "Successful" : "Failed"}`, margin, margin + 40);
    pdf.text(`Workflow Completion: ${results.interactionSuccessful ? "Successful" : "Failed"}`, margin, margin + 50);
    
    // Calculate test metrics
    const metrics = calculateTestMetrics(results);
    
    // Track vertical position
    let yPos = margin + 60;
    
    // Add test metrics summary
    pdf.text(`Test Metrics:`, margin, yPos);
    pdf.setFontSize(10);
    yPos += 10;
    pdf.text(`Total Tests: ${metrics.totalTests}`, margin + 5, yPos);
    yPos += 10;
    pdf.text(`Passed: ${metrics.passedTests} (${metrics.passRate}%)`, margin + 5, yPos);
    yPos += 10;
    pdf.text(`Failed: ${metrics.failedTests}`, margin + 5, yPos);
    yPos += 10;
    
    // Draw a simple pass rate progress bar
    const progressBarWidth = 100;
    const fillWidth = (metrics.passRate / 100) * progressBarWidth;
    
    // Draw the background
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin + 5, yPos, progressBarWidth, 5, 'F');
    
    // Draw the fill - green for high pass rates, yellow for medium, red for low
    if (metrics.passRate >= 80) {
      pdf.setFillColor(0, 200, 0); // Green
    } else if (metrics.passRate >= 50) {
      pdf.setFillColor(240, 200, 0); // Yellow
    } else {
      pdf.setFillColor(220, 0, 0); // Red
    }
    
    if (fillWidth > 0) {
      pdf.rect(margin + 5, yPos, fillWidth, 5, 'F');
    }
    
    yPos += 15; // Update vertical position after metrics
    
    // Add test steps section title
    pdf.setFontSize(14);
    pdf.text("Test Steps", margin, yPos);
    yPos += 10;
    
    // Function to add LLM decision details to PDF
    const addLLMDecisionToPdf = (llmDecision: any, startY: number): number => {
      let y = startY;
      
      if (!llmDecision) return y;
      
      pdf.setFontSize(11);
      pdf.text("LLM Decision Details:", margin + 5, y);
      y += 6;
      
      // Basic details
      pdf.setFontSize(9);
      pdf.text(`• Action: ${llmDecision.action}`, margin + 8, y); y += 5;
      pdf.text(`• Confidence: ${llmDecision.confidence}%`, margin + 8, y); y += 5;
      
      if (llmDecision.value) {
        pdf.text(`• Value: ${llmDecision.value}`, margin + 8, y); y += 5;
      }
      
      // Reasoning
      if (llmDecision.reasoning) {
        pdf.text("• Reasoning:", margin + 8, y); y += 5;
        
        const reasoningText = pdf.splitTextToSize(llmDecision.reasoning, contentWidth - 16);
        
        // Check if we need a new page
        if (y + (reasoningText.length * 3.5) > pageHeight - margin) {
          pdf.addPage();
          y = margin + 10;
        }
        
        pdf.setFontSize(8);
        pdf.text(reasoningText, margin + 10, y);
        y += (reasoningText.length * 3.5) + 3;
      }
      
      // Explanation
      if (llmDecision.explanation) {
        // Check if we need a new page
        if (y + 15 > pageHeight - margin) {
          pdf.addPage();
          y = margin + 10;
        }
        
        pdf.setFontSize(9);
        pdf.text("• Explanation:", margin + 8, y); y += 5;
        
        const explanationText = pdf.splitTextToSize(llmDecision.explanation, contentWidth - 16);
        
        pdf.setFontSize(8);
        pdf.text(explanationText, margin + 10, y);
        y += (explanationText.length * 3.5) + 3;
      }
      
      // Target element
      if (llmDecision.targetElement) {
        // Check if we need a new page
        if (y + 15 > pageHeight - margin) {
          pdf.addPage();
          y = margin + 10;
        }
        
        pdf.setFontSize(9);
        pdf.text("• Target Element:", margin + 8, y); y += 5;
        
        pdf.setFontSize(8);
        pdf.text(`Tag: ${llmDecision.targetElement.tag}`, margin + 10, y); y += 4;
        
        if (llmDecision.targetElement.id) {
          pdf.text(`ID: ${llmDecision.targetElement.id}`, margin + 10, y); y += 4;
        }
        
        if (llmDecision.targetElement.text) {
          const textContent = `Text: ${llmDecision.targetElement.text}`;
          const wrappedText = pdf.splitTextToSize(textContent, contentWidth - 20);
          pdf.text(wrappedText, margin + 10, y);
          y += (wrappedText.length * 3.5);
        }
        
        if (llmDecision.targetElement.classes && llmDecision.targetElement.classes.length > 0) {
          const classesText = `Classes: ${llmDecision.targetElement.classes.join(', ')}`;
          const wrappedClasses = pdf.splitTextToSize(classesText, contentWidth - 20);
          pdf.text(wrappedClasses, margin + 10, y);
          y += (wrappedClasses.length * 3.5);
        }
      }
      
      return y + 5; // Add some spacing
    };
    
    // Function to add step information
    const addStepToPdf = async (stepNumber: number, name: string, status: string, llmDecision: any, error: string | null, screenshot?: string, llmFeedback?: string, parsedLLMFeedback?: LLMFeedback) => {
      // Check if we need a new page for this step
      if (yPos > pageHeight - 60) {
        pdf.addPage();
        yPos = margin + 10;
      }
      
      // Add step title and status
      pdf.setFontSize(11);
      pdf.text(`Step ${stepNumber}: ${name}`, margin, yPos);
      
      // Add status indicator
      pdf.setTextColor(status === "Success" ? 0x00 : 0xFF, status === "Success" ? 0x99 : 0x00, 0x00);
      pdf.text(status, margin + 150, yPos);
      pdf.setTextColor(0, 0, 0); // Reset text color
      
      yPos += 6;
      
      // Add LLM feedback if available
      if (llmFeedback) {
        yPos += 20;
        pdf.setTextColor(0, 0, 0);
        pdf.text("LLM Feedback:", margin + 5, yPos);
        
        yPos += 5;
        
        // Set color based on feedback status
        if (parsedLLMFeedback) {
          if (parsedLLMFeedback.status === 'FAIL') {
            pdf.setTextColor(220, 53, 69); // Red for failures
          } else {
            pdf.setTextColor(0, 123, 255); // Blue for passes
          }
          
          // Add status
          pdf.setFontSize(9);
          pdf.text(`Status: ${parsedLLMFeedback.status}`, margin + 10, yPos += 10);
          
          // Add reason
          const feedbackText = pdf.splitTextToSize(parsedLLMFeedback.reason, contentWidth - 16);
          pdf.text(feedbackText, margin + 10, yPos += 6);
        } else {
          const feedbackText = pdf.splitTextToSize(llmFeedback, contentWidth - 16);
          pdf.text(feedbackText, margin + 10, yPos += 6);
        }
        
        // Reset text color
        pdf.setTextColor(0, 0, 0);
      }
      
      // Add error details if any
      if (error) {
        pdf.setFontSize(9);
        pdf.text("Error:", margin + 5, yPos);
        yPos += 5;
        
        const errorText = pdf.splitTextToSize(error, contentWidth - 16);
        
        pdf.setFontSize(8);
        pdf.setTextColor(255, 0, 0); // Red text for errors
        pdf.text(errorText, margin + 10, yPos);
        pdf.setTextColor(0, 0, 0); // Reset text color
        yPos += (errorText.length * 3.5) + 3;
      }
      
      // Add LLM decision details if available
      if (llmDecision) {
        yPos = addLLMDecisionToPdf(llmDecision, yPos);
      }
      
      // Add screenshot if available
      if (isValidScreenshot(screenshot)) {
        try {
          // Create an img element to load the screenshot
          const img = new Image();
          img.src = getValidImageUrl(screenshot);
          
          // Wait for image to load
          const loadedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
          });
          
          // Calculate image dimensions to fit in the page
          const imgWidth = loadedImg.width;
          const imgHeight = loadedImg.height;
          const aspectRatio = imgWidth / imgHeight;
          
          let pdfImgWidth = contentWidth;
          let pdfImgHeight = pdfImgWidth / aspectRatio;
          
          // If image height is too big, scale it down
          if (pdfImgHeight > 120) {
            pdfImgHeight = 120;
            pdfImgWidth = pdfImgHeight * aspectRatio;
          }
          
          // Check if we need a new page for the image
          if (yPos + pdfImgHeight > pageHeight - margin) {
            pdf.addPage();
            yPos = margin + 10;
          }
          
          // Add the image to PDF
          pdf.addImage(
            getValidImageUrl(screenshot), 
            'PNG', 
            margin, 
            yPos, 
            pdfImgWidth, 
            pdfImgHeight
          );
          
          yPos += pdfImgHeight + 10;
        } catch (error) {
          console.error('Error adding screenshot to PDF:', error);
          yPos += 5;
        }
      }
      
      // Add spacing after step
      yPos += 5;
    };
    
    // Add steps
    const hasCustomSteps = results.customStepsResults && results.customStepsResults.length > 0;
    
    if (hasCustomSteps) {
      // Add custom steps
      pdf.setFontSize(13);
      pdf.text("Custom Steps", margin, yPos);
      yPos += 10;
      
      // Process steps sequentially
      results.customStepsResults?.forEach((step, index) => {
        // Parse LLM feedback if not already parsed
        const parsedFeedback = step.parsedLLMFeedback || parseLLMFeedback(step.llmFeedback);
        
        addStepToPdf(
          index + 1,
          step.instruction,
          step.status || (step.success ? 'success' : 'failure'),
          step.llmDecision,
          step.error || null,
          step.screenshot,
          step.llmFeedback,
          parsedFeedback
        );
      });
    } else {
      // Add regular steps
      for (let index = 0; index < results.steps.length; index++) {
        const step = results.steps[index];
        
        // Parse LLM feedback if not already parsed
        const parsedFeedback = step.parsedLLMFeedback || parseLLMFeedback(step.llmFeedback);
        
        await addStepToPdf(
          index + 1,
          step.name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
          step.status,
          step.llmDecision,
          step.error || null,
          step.screenshot,
          step.llmFeedback,
          parsedFeedback
        );
      }
    }
    
    // Add errors if any
    if (results.errors && results.errors.length > 0) {
      // Check if we need a new page
      if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = margin + 10;
      }
      
      pdf.setFontSize(14);
      pdf.text("Errors", margin, yPos);
      yPos += 10;
      
      results.errors.forEach((error: TestError, index) => {
        pdf.setFontSize(12);
        pdf.text(`Error ${index + 1}: ${error.message}`, margin, yPos);
        yPos += 8;
        
        // Add error details with word wrapping
        if (error.details) {
          pdf.setFontSize(10);
          const splitDetails = pdf.splitTextToSize(error.details, contentWidth);
          
          // Check if we need a new page
          if (yPos + (splitDetails.length * 5) > pageHeight - margin) {
            pdf.addPage();
            yPos = margin + 10;
          }
          
          pdf.text(splitDetails, margin, yPos);
          yPos += (splitDetails.length * 5) + 5;
        }
      });
    }
    
    // Restore the original accordion states
    accordionTriggers.forEach((trigger, index) => {
      const currentExpanded = trigger.getAttribute('data-state') === 'open';
      if (currentExpanded !== originalStates[index]) {
        (trigger as HTMLElement).click();
      }
    });
    
    // Save the PDF
    pdf.save(`test-report-${results.testId}.pdf`);
    
    onSuccess();
  } catch (error) {
    console.error('Error generating PDF:', error);
    onError(error);
  }
}; 