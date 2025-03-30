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

  const runTest = async (url: string) => {
    try {
      setIsLoading(true);
      setTestResults(null);
      
      const response = await fetch('/api/test-booking-flow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, options: { timeout: 60000, screenshotCapture: true } }),
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
              Enter the URL of your landing page to start testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UrlInputForm onSubmit={runTest} isLoading={isLoading} />
          </CardContent>
        </Card>
      </section>

      {(isLoading || testResults) && (
        <section className="max-w-5xl mx-auto">
          <TestResults 
            results={testResults} 
            isLoading={isLoading} 
          />
        </section>
      )}
    </div>
  );
}
