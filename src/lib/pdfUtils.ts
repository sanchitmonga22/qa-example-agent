import { TestWebsiteResponse, TestError, TestStep } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

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
    
    // Track vertical position
    let yPos = margin + 60;
    
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
    const addStepToPdf = async (stepNumber: number, name: string, status: string, llmDecision: any, error: string | null, screenshot?: string) => {
      pdf.setFontSize(12);
      
      // Check if we need a new page
      if (yPos > pageHeight - margin * 4) {
        pdf.addPage();
        yPos = margin + 10;
      }
      
      // Add step info
      pdf.text(`${stepNumber}. ${name} - ${status}`, margin, yPos);
      yPos += 8;
      
      // Add LLM decision details
      if (llmDecision) {
        yPos = addLLMDecisionToPdf(llmDecision, yPos);
      }
      
      // Add error if present
      if (error) {
        // Check if we need a new page
        if (yPos + 15 > pageHeight - margin) {
          pdf.addPage();
          yPos = margin + 10;
        }
        
        pdf.setFontSize(11);
        pdf.text("Error:", margin + 5, yPos);
        yPos += 5;
        
        const errorText = pdf.splitTextToSize(error, contentWidth - 10);
        pdf.setFontSize(9);
        pdf.text(errorText, margin + 8, yPos);
        yPos += (errorText.length * 3.5) + 5;
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
      for (let index = 0; index < results.customStepsResults!.length; index++) {
        const step = results.customStepsResults![index];
        await addStepToPdf(
          index + 1, 
          step.instruction, 
          step.success ? "Success" : "Failure",
          step.llmDecision,
          step.error || null,
          step.screenshot
        );
      }
    } else {
      // Add regular steps
      for (let index = 0; index < results.steps.length; index++) {
        const step = results.steps[index];
        await addStepToPdf(
          index + 1, 
          step.name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()), 
          step.status === "success" ? "Success" : "Failure",
          step.llmDecision,
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