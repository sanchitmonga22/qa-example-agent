"use client";

import { useState } from "react";
import { toast } from "sonner";
import UrlInputForm from "@/components/UrlInputForm";
import TestResults from "@/components/TestResults";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TestBookingFlowResponse } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

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
      <PageHeader 
        title="Web Interaction Testing Tool"
        description="Automatically test user flows on websites. Simply enter the URL below and we'll validate interactions with your predefined test steps."
      />

      <section className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Test Your Website</CardTitle>
            <CardDescription>
              Enter the URL of your website to start testing. You can edit the pre-populated test steps or add your own to validate specific interactions.
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
                  Please wait while we test your website
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    We are currently testing your website with the specified steps. This may take up to a minute.
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
