"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import StatusIndicator from "./StatusIndicator";
import ErrorDisplay from "./ErrorDisplay";
import Screenshots from "./Screenshots";
import { TestBookingFlowResponse } from "@/lib/types";

interface TestResultsProps {
  results: TestBookingFlowResponse | null;
  isLoading?: boolean;
  className?: string;
}

export default function TestResults({ 
  results, 
  isLoading = false,
  className = "" 
}: TestResultsProps) {
  if (isLoading) {
    return (
      <div className={`${className} space-y-4`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <StatusIndicator status="running" className="mr-2" />
              Testing in progress
            </CardTitle>
            <CardDescription>
              Please wait while we test the booking flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                We are currently checking if the landing page has a booking flow and
                attempting to complete the process.
              </p>
              <div className="flex justify-center">
                <div className="h-2 w-full max-w-md bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const overallStatus = results.success ? "success" : "failure";

  return (
    <div className={`${className} space-y-8`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <StatusIndicator status={overallStatus} className="mr-2" />
            Test Results
          </CardTitle>
          <CardDescription>
            Test ID: {results.testId} | 
            Duration: {(results.totalDuration / 1000).toFixed(2)}s
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded p-4">
                <p className="text-sm font-medium mb-1">Demo Flow Detection</p>
                <div className="flex items-center">
                  <StatusIndicator 
                    status={results.demoFlowFound ? "success" : "failure"} 
                    size={18} 
                  />
                  <span className="ml-2 text-sm">
                    {results.demoFlowFound 
                      ? "Book a Demo flow found" 
                      : "No Book a Demo flow detected"}
                  </span>
                </div>
              </div>
              
              <div className="border rounded p-4">
                <p className="text-sm font-medium mb-1">Booking Process</p>
                <div className="flex items-center">
                  <StatusIndicator 
                    status={results.bookingSuccessful ? "success" : "failure"} 
                    size={18} 
                  />
                  <span className="ml-2 text-sm">
                    {results.bookingSuccessful 
                      ? "Booking completed successfully" 
                      : "Booking process failed"}
                  </span>
                </div>
              </div>
            </div>
            
            {results.errors.length > 0 && (
              <ErrorDisplay errors={results.errors} />
            )}
          </div>
        </CardContent>
      </Card>

      <Screenshots steps={results.steps} />
    </div>
  );
} 