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
              {step.screenshot ? (
                <div className="relative aspect-video w-full overflow-hidden">
                  <Image
                    src={`data:image/png;base64,${step.screenshot}`}
                    alt={`Screenshot of ${step.name}`}
                    fill
                    className="object-contain"
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
              {step.screenshot ? (
                <div className="relative aspect-video w-full overflow-hidden">
                  <Image
                    src={`data:image/png;base64,${step.screenshot}`}
                    alt={`Screenshot of custom step ${index + 1}`}
                    fill
                    className="object-contain"
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
      </div>
    </div>
  );
} 