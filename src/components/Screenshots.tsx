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
              {isValidScreenshot(step.screenshot) ? (
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
              )}
              
              {step.llmFeedback && (
                <div className={`mt-2 text-xs ${
                  step.parsedLLMFeedback?.status === 'FAIL' 
                    ? 'text-red-600' 
                    : 'text-blue-600'
                }`}>
                  <strong>LLM Feedback:</strong> 
                  {step.parsedLLMFeedback ? (
                    <>
                      <span className="font-semibold">{step.parsedLLMFeedback.status}</span>: {step.parsedLLMFeedback.reason}
                    </>
                  ) : (
                    step.llmFeedback
                  )}
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
      </div>
    </div>
  );
} 