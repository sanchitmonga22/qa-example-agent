"use client";

import { Fragment } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDuration } from "@/lib/utils";
import StatusIndicator from "@/components/StatusIndicator";
import Screenshots from "@/components/Screenshots";
import { TestWebsiteResponse, TestError, TestStep } from "@/lib/types";

interface TestResultsProps {
  results: TestWebsiteResponse;
}

export default function TestResults({ results }: TestResultsProps) {
  // Check if there are any completed custom steps
  const hasCustomSteps = results.customStepsResults && results.customStepsResults.length > 0;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="font-bold text-xl text-gray-900">Test Results</span>
        <StatusIndicator 
          status={results.success ? "success" : "failure"} 
          label={results.success ? "Passed" : "Failed"} 
        />
      </div>
      
      <div className="text-sm text-muted-foreground">
        URL: {results.url} • Test ID: {results.testId} • Duration: {formatDuration(results.totalDuration)}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">CTA Detection</CardTitle>
              <StatusIndicator 
                status={results.primaryCTAFound ? "success" : "failure"} 
              />
            </div>
          </CardHeader>
          <CardContent>
            {results.primaryCTAFound
              ? "Successfully found the primary interactive element"
              : "Could not detect a primary call to action"}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Workflow Completion</CardTitle>
              <StatusIndicator 
                status={results.interactionSuccessful ? "success" : "failure"} 
              />
            </div>
          </CardHeader>
          <CardContent>
            {results.interactionSuccessful
            ? "Successfully completed the test workflow"
            : "Could not complete the test workflow"}
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="steps">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="steps">Test Steps</TabsTrigger>
          <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
        </TabsList>
        
        <TabsContent value="steps" className="space-y-4 mt-4">
          {hasCustomSteps ? (
            <div>
              <h3 className="text-lg font-semibold mb-2">Custom Steps</h3>
              <div className="space-y-2">
                {results.customStepsResults!.map((step, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Step {index + 1}</CardTitle>
                        <StatusIndicator 
                          status={step.success ? "success" : "failure"} 
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm font-medium">Instruction:</div>
                      <div className="text-sm">{step.instruction}</div>
                      
                      {step.error && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription className="text-xs">{step.error}</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-2">Test Steps</h3>
              <div className="space-y-2">
                {results.steps.map((step: TestStep, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {step.name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </CardTitle>
                        <StatusIndicator status={step.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        Duration: {formatDuration(step.duration || 0)}
                      </div>
                      
                      {step.error && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertTitle>Error</AlertTitle>
                          <AlertDescription className="text-xs">{step.error}</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {results.errors.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-destructive mb-2">Errors</h3>
              <Accordion type="single" collapsible className="w-full">
                {results.errors.map((error: TestError, index) => (
                  <AccordionItem key={index} value={`error-${index}`}>
                    <AccordionTrigger className="text-destructive">
                      {error.message}
                    </AccordionTrigger>
                    <AccordionContent>
                      <pre className="text-xs whitespace-pre-wrap bg-gray-100 p-2 rounded">
                        {error.details}
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="screenshots" className="mt-4">
          <Screenshots steps={results.steps} customSteps={results.customStepsResults} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 