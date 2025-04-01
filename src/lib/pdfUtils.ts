import { TestWebsiteResponse, TestError } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { pdfLogger } from "@/lib/logger";

// Helper function to sanitize and validate base64 data
export const getValidImageUrl = (base64Data?: string): string => {
  if (!base64Data || base64Data.trim() === '' || base64Data.length < 100) {
    return '';
  }
  
  // If it already has a data URL prefix, return it as is
  if (base64Data.startsWith('data:image/')) {
    return base64Data;
  }
  
  // Extract base64 content if it already has a data URL prefix of any kind
  if (base64Data.startsWith('data:')) {
    const parts = base64Data.split(',');
    if (parts.length > 1) {
      base64Data = parts[1];
    }
  }
  
  // Add the proper prefix - use PNG format for better compatibility
  return `data:image/png;base64,${base64Data.trim()}`;
};

// Helper to check if a screenshot is valid
export const isValidScreenshot = (screenshot?: string): boolean => {
  return !!screenshot && screenshot.trim() !== '' && screenshot.length > 100;
};

export const generateTestResultsPDF = async (
  results: TestWebsiteResponse, 
  reportElement: HTMLElement,
  onStart: () => void,
  onSuccess: () => void,
  onError: (error: any) => void
) => {
  try {
    pdfLogger.info(`Starting PDF generation for test ID: ${results.testId}`);
    
    // Import libraries dynamically to reduce initial bundle size
    const [jsPDF, html2canvas] = await Promise.all([
      import('jspdf').then(module => module.default),
      import('html2canvas').then(module => module.default)
    ]);
    
    if (!reportElement) {
      pdfLogger.error('Report element not found');
      return;
    }
    
    onStart();
    pdfLogger.debug('PDF generation started');
    
    const content = reportElement;
    
    // First, expand all the accordions for the PDF
    const accordionTriggers = content.querySelectorAll('.accordion-trigger');
    const originalStates: boolean[] = [];
    
    pdfLogger.debug(`Found ${accordionTriggers.length} accordion triggers`);
    
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
    
    pdfLogger.debug('PDF instance created with A4 dimensions');
    
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
    
    // Track vertical position
    let yPos = margin + 60;
    
    // Add test steps section title
    pdf.setFontSize(14);
    pdf.text("Test Steps", margin, yPos);
    yPos += 10;
    
    pdfLogger.debug('Added basic test information to PDF');
    
    // Function to add LLM decision details to PDF
    const addLLMDecisionToPdf = (llmDecision: any, startY: number): number => {
      let y = startY;
      
      if (!llmDecision) return y;
      
      pdfLogger.debug(`Adding LLM decision details, action: ${llmDecision.action}, confidence: ${llmDecision.confidence}`);
      
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
          pdfLogger.debug('Added new page for LLM reasoning');
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
          pdfLogger.debug('Added new page for LLM explanation');
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
          pdfLogger.debug('Added new page for target element details');
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
    
    // Function to add Vision API analysis to PDF
    const addVisionAnalysisToPdf = (visionAnalysis: any, startY: number): number => {
      let y = startY;
      
      if (!visionAnalysis) return y;
      
      pdfLogger.debug(`Adding Vision API analysis, result: ${visionAnalysis.isPassed ? 'PASSED' : 'FAILED'}, confidence: ${visionAnalysis.confidence}`);
      
      pdf.setFontSize(11);
      pdf.text("Vision API Analysis:", margin + 5, y);
      y += 6;
      
      // Basic details
      pdf.setFontSize(9);
      pdf.text(`• Result: ${visionAnalysis.isPassed ? "PASSED" : "FAILED"}`, margin + 8, y); y += 5;
      pdf.text(`• Confidence: ${visionAnalysis.confidence}%`, margin + 8, y); y += 5;
      
      // Reasoning
      if (visionAnalysis.reasoning) {
        pdf.text("• Visual Analysis:", margin + 8, y); y += 5;
        
        const reasoningText = pdf.splitTextToSize(visionAnalysis.reasoning, contentWidth - 16);
        
        // Check if we need a new page
        if (y + (reasoningText.length * 3.5) > pageHeight - margin) {
          pdf.addPage();
          y = margin + 10;
          pdfLogger.debug('Added new page for Vision API reasoning');
        }
        
        pdf.setFontSize(8);
        pdf.text(reasoningText, margin + 10, y);
        y += (reasoningText.length * 3.5) + 3;
      }
      
      // Add before/after screenshots side by side if available
      if (visionAnalysis.beforeScreenshot && visionAnalysis.afterScreenshot) {
        // Check if we need a new page - screenshots need more space
        if (y + 70 > pageHeight - margin) {
          pdf.addPage();
          y = margin + 10;
          pdfLogger.debug('Added new page for before/after screenshots');
        }
        
        pdf.setFontSize(9);
        pdf.text("• Before & After Screenshots:", margin + 8, y); y += 6;
        
        // Try to add before screenshot
        if (isValidScreenshot(visionAnalysis.beforeScreenshot)) {
          try {
            const beforeImgData = getValidImageUrl(visionAnalysis.beforeScreenshot);
            const halfWidth = (contentWidth - 10) / 2;
            
            pdf.addImage(
              beforeImgData, 
              'PNG', 
              margin + 8, 
              y, 
              halfWidth, 
              50, 
              'before_img', 
              'FAST'
            );
            
            // Add label
            pdf.setFontSize(8);
            pdf.text("Before", margin + 8 + (halfWidth / 2) - 8, y - 2);
            
            pdfLogger.debug('Added before screenshot to PDF');
          } catch (e) {
            pdfLogger.error('Error adding before screenshot to PDF', e);
            console.error('Error adding before screenshot to PDF:', e);
          }
        }
        
        // Try to add after screenshot
        if (isValidScreenshot(visionAnalysis.afterScreenshot)) {
          try {
            const afterImgData = getValidImageUrl(visionAnalysis.afterScreenshot);
            const halfWidth = (contentWidth - 10) / 2;
            
            pdf.addImage(
              afterImgData, 
              'PNG', 
              margin + 12 + halfWidth, 
              y, 
              halfWidth, 
              50, 
              'after_img', 
              'FAST'
            );
            
            // Add label
            pdf.setFontSize(8);
            pdf.text("After", margin + 12 + halfWidth + (halfWidth / 2) - 8, y - 2);
            
            pdfLogger.debug('Added after screenshot to PDF');
          } catch (e) {
            pdfLogger.error('Error adding after screenshot to PDF', e);
            console.error('Error adding after screenshot to PDF:', e);
          }
        }
        
        y += 55; // Move down past the screenshots
      }
      
      return y + 5; // Add some spacing
    };
    
    // Function to add step information
    const addStepToPdf = async (stepNumber: number, name: string, status: string, llmDecision: any, visionAnalysis: any, error: string | null, screenshot?: string) => {
      pdfLogger.info(`Adding step ${stepNumber}: ${name} (${status}) to PDF`);
      
      pdf.setFontSize(12);
      
      // Check if we need a new page
      if (yPos > pageHeight - margin * 4) {
        pdf.addPage();
        yPos = margin + 10;
        pdfLogger.debug(`Added new page for step ${stepNumber}`);
      }
      
      // Add step info
      pdf.text(`${stepNumber}. ${name} - ${status}`, margin, yPos);
      yPos += 8;
      
      // Add LLM decision details
      if (llmDecision) {
        yPos = addLLMDecisionToPdf(llmDecision, yPos);
      }
      
      // Add Vision API analysis
      if (visionAnalysis) {
        yPos = addVisionAnalysisToPdf(visionAnalysis, yPos);
      }
      
      // Add error if present
      if (error) {
        // Check if we need a new page
        if (yPos + 15 > pageHeight - margin) {
          pdf.addPage();
          yPos = margin + 10;
          pdfLogger.debug(`Added new page for error in step ${stepNumber}`);
        }
        
        pdf.setFontSize(11);
        pdf.text("Error:", margin + 5, yPos);
        yPos += 5;
        
        const errorText = pdf.splitTextToSize(error, contentWidth - 10);
        pdf.setFontSize(9);
        pdf.text(errorText, margin + 8, yPos);
        yPos += (errorText.length * 3.5) + 5;
        
        pdfLogger.warn(`Error in step ${stepNumber}: ${error}`);
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
            pdfLogger.debug(`Added new page for screenshot in step ${stepNumber}`);
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
          pdfLogger.debug(`Added screenshot to step ${stepNumber}`);
        } catch (error) {
          pdfLogger.error(`Error adding screenshot to step ${stepNumber}`, error);
          console.error('Error adding screenshot to PDF:', error);
          yPos += 5;
        }
      }
      
      // Add spacing after step
      yPos += 5;
    };
    
    // Add custom steps if available
    if (results.customStepsResults && results.customStepsResults.length > 0) {
      pdf.addPage();
      yPos = margin + 20;
      
      pdf.setFontSize(14);
      pdf.text("Custom Test Steps", margin, yPos);
      yPos += 10;
      
      pdfLogger.info(`Adding ${results.customStepsResults.length} custom steps to PDF`);
      
      for (let i = 0; i < results.customStepsResults.length; i++) {
        const step = results.customStepsResults[i];
        await addStepToPdf(
          i + 1,
          step.instruction,
          step.status === "success" ? "Success" : "Failure",
          step.llmDecision,
          step.visionAnalysis,
          step.error || null,
          step.screenshot
        );
      }
    }

    // Add standard steps
    if (results.steps && results.steps.length > 0) {
      pdf.addPage();
      yPos = margin + 20;
      
      pdf.setFontSize(14);
      pdf.text("Standard Test Steps", margin, yPos);
      yPos += 10;
      
      pdfLogger.info(`Adding ${results.steps.length} standard steps to PDF`);
      
      for (let i = 0; i < results.steps.length; i++) {
        const step = results.steps[i];
        await addStepToPdf(
          i + 1,
          step.name,
          step.status === "success" ? "Success" : "Failure",
          step.llmDecision,
          null, // Standard steps don't have Vision API analysis
          step.error || null,
          step.screenshot
        );
      }
    }
    
    // Add errors if any
    if (results.errors && results.errors.length > 0) {
      // Check if we need a new page
      if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = margin + 10;
        pdfLogger.debug('Added new page for errors section');
      }
      
      pdf.setFontSize(14);
      pdf.text("Errors", margin, yPos);
      yPos += 10;
      
      pdfLogger.info(`Adding ${results.errors.length} errors to PDF`);
      
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
            pdfLogger.debug(`Added new page for error ${index + 1} details`);
          }
          
          pdf.text(splitDetails, margin, yPos);
          yPos += (splitDetails.length * 5) + 5;
        }
        
        pdfLogger.error(`Error ${index + 1}: ${error.message}`, error.details);
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
    pdfLogger.info(`Saving PDF as test-report-${results.testId}.pdf`);
    pdf.save(`test-report-${results.testId}.pdf`);
    
    onSuccess();
    pdfLogger.info('PDF generation completed successfully');
  } catch (error) {
    pdfLogger.error('Error generating PDF', error);
    console.error('Error generating PDF:', error);
    onError(error);
  }
}; 