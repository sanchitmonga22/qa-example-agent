"use client";

import { useState } from "react";
import { toast } from "sonner";
import UrlInputForm from "@/components/UrlInputForm";
import TestResults from "@/components/TestResults";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TestBookingFlowResponse } from "@/lib/types";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestBookingFlowResponse | null>(null);

  const runTest = async (url: string, customSteps?: string[]) => {
    try {
      setIsLoading(true);
      setTestResults(null);
      
      const requestBody: any = { 
        url, 
        options: { timeout: 60000, screenshotCapture: true }
      };
      
      if (customSteps && customSteps.length > 0) {
        requestBody.customSteps = customSteps;
      }
      
      const response = await fetch('/api/test-booking-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to run test');
      }
      
      const result: TestBookingFlowResponse = await response.json();
      setTestResults(result);
      
      if (result.success) {
        toast.success("Test completed successfully!");
      } else {
        toast.error("Test completed with errors");
      }
    } catch (error) {
      console.error("Error running test:", error);
      toast.error(error instanceof Error ? error.message : "Failed to run test. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <section className="text-center max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-3">
          Landing Page Lead Funnel Validation Tool
        </h1>
        <p className="text-gray-600">
          Automatically test the "Book a Demo" flow on your landing pages. Simply enter the URL
          below and we'll validate the entire booking process.
        </p>
      </section>

      <section className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Test Your Landing Page</CardTitle>
            <CardDescription>
              Enter the URL of your landing page to start testing. You can also add custom test steps to validate specific interactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UrlInputForm onSubmit={runTest} isLoading={isLoading} />
          </CardContent>
        </Card>
      </section>

      {(isLoading || testResults) && (
        <section className="max-w-5xl mx-auto">
          {isLoading ? (
            <Card>
              <CardHeader>
                <CardTitle>Testing in progress...</CardTitle>
                <CardDescription>
                  Please wait while we test your landing page
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    We are currently testing the booking flow on your landing page. This may take up to a minute.
                  </p>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : testResults ? (
            <TestResults results={testResults} />
          ) : null}
        </section>
      )}
    </div>
  );
}
