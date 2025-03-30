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
      
      // In a real implementation, this would call the API endpoint
      // For now, we'll simulate an API call with a timeout
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock response for demonstration purposes
      const mockResponse: TestBookingFlowResponse = {
        success: true,
        testId: `test-${Date.now()}`,
        demoFlowFound: true,
        bookingSuccessful: true,
        totalDuration: 6390,
        errors: [],
        steps: [
          {
            name: "Landing Page Load",
            status: "success",
            duration: 1240,
            screenshot: undefined, // In real implementation, this would be a base64 image
          },
          {
            name: "Demo Button Detection",
            status: "success",
            duration: 350,
            screenshot: undefined,
          },
          {
            name: "Form Fill",
            status: "success",
            duration: 2100,
            screenshot: undefined,
          },
          {
            name: "Form Submission",
            status: "success",
            duration: 1800,
            screenshot: undefined,
          },
          {
            name: "Confirmation Detection",
            status: "success",
            duration: 900,
            screenshot: undefined,
          }
        ]
      };
      
      setTestResults(mockResponse);
      toast.success("Test completed successfully!");
    } catch (error) {
      console.error("Error running test:", error);
      toast.error("Failed to run test. Please try again.");
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
