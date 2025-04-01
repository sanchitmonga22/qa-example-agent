"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusIndicator from "./StatusIndicator";
import { CustomStepResult, TestStep } from "@/lib/types";

interface ScreenshotsProps {
  steps: TestStep[];
  customSteps?: CustomStepResult[];
  className?: string;
}

export default function Screenshots({ steps, customSteps = [], className = "" }: ScreenshotsProps) {
  if ((!steps || steps.length === 0) && (!customSteps || customSteps.length === 0)) {
    return null;
  }

  // Helper function to sanitize and validate base64 data
  const getValidImageUrl = (base64Data?: string): string => {
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
  const isValidScreenshot = (screenshot?: string): boolean => {
    return !!screenshot && screenshot.trim() !== '';
  };
  
  // Helper to get the correct "before" screenshot for custom steps
  const getBeforeScreenshotForCustomStep = (index: number): string | undefined => {
    if (index === 0) {
      // For the first custom step, use the last standard step's screenshot if available
      return steps.length > 0 ? steps[steps.length - 1].screenshot : undefined;
    } else {
      // For subsequent steps, use the previous custom step's screenshot
      return customSteps[index - 1].screenshot;
    }
  };
  
  // Helper to check if two screenshots are identical
  const areScreenshotsIdentical = (screenshot1?: string, screenshot2?: string): boolean => {
    if (!screenshot1 || !screenshot2) return false;
    
    // Instead of a direct string comparison which might identify screenshots as identical
    // when they have minor differences in encoding but visible differences to users,
    // we'll check if the screenshots exactly match or if they're both over a certain length
    // and the first and last 1000 characters match
    
    // If the strings are exactly the same, they're identical
    if (screenshot1 === screenshot2) {
      // Direct exact match - very likely identical screenshots
      return true;
    }
    
    // For this use case, we'll return false to avoid showing the message when screenshots
    // are visually different but might have some encoded similarities
    return false;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <h3 className="text-xl font-semibold">Test Steps</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {steps.map((step, index) => (
          <Card key={`step-${index}`} className="overflow-hidden">
            <CardHeader className="bg-gray-50 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-medium">
                  {index + 1}. {step.name}
                </CardTitle>
                <StatusIndicator status={step.status} size={16} />
              </div>
              {step.duration && (
                <p className="text-xs text-gray-500">
                  Duration: {(step.duration / 1000).toFixed(2)}s
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {isValidScreenshot(step.screenshot) ? (
                <div className="relative aspect-video w-full overflow-hidden">
                  <img
                    src={getValidImageUrl(step.screenshot)}
                    alt={`Screenshot of ${step.name}`}
                    className="object-contain w-full h-full"
                  />
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center bg-gray-100">
                  <p className="text-gray-500 text-sm">No screenshot available</p>
                </div>
              )}
              
              {step.error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm">
                  {step.error}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {customSteps.map((step, index) => (
          <Card key={`custom-${index}`} className="overflow-hidden">
            <CardHeader className="bg-gray-50 pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-medium">
                  {steps.length + index + 1}. {step.instruction}
                </CardTitle>
                <StatusIndicator 
                  status={step.status || (step.success ? "success" : "failure")} 
                  size={16} 
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* If we have vision analysis with before/after screenshots, show them side by side */}
              {step.visionAnalysis && step.visionAnalysis.beforeScreenshot && step.visionAnalysis.afterScreenshot ? (
                <div className="p-2">
                  {/* Show a notice if screenshots are identical */}
                  {areScreenshotsIdentical(step.visionAnalysis.beforeScreenshot, step.visionAnalysis.afterScreenshot) && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-2 text-amber-800 text-xs">
                      Note: The before and after screenshots appear identical, indicating no visible changes occurred.
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-center mb-1 text-gray-500">Before</div>
                      <div className="border rounded overflow-hidden">
                        <img
                          src={getValidImageUrl(
                            // Use either the specified before screenshot or get it from the previous step
                            step.visionAnalysis.beforeScreenshot || getBeforeScreenshotForCustomStep(index)
                          )}
                          alt={`Before screenshot of ${step.instruction}`}
                          className="object-contain w-full"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-center mb-1 text-gray-500">After</div>
                      <div className="border rounded overflow-hidden">
                        <img
                          src={getValidImageUrl(step.visionAnalysis.afterScreenshot)}
                          alt={`After screenshot of ${step.instruction}`}
                          className="object-contain w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Regular single screenshot display
                isValidScreenshot(step.screenshot) ? (
                  <div className="relative aspect-video w-full overflow-hidden">
                    <img
                      src={getValidImageUrl(step.screenshot)}
                      alt={`Screenshot of custom step ${index + 1}`}
                      className="object-contain w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center bg-gray-100">
                    <p className="text-gray-500 text-sm">No screenshot available</p>
                  </div>
                )
              )}
              
              {step.error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm">
                  {step.error}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 