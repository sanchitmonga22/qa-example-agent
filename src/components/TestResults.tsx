"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import StatusIndicator from "./StatusIndicator";
import ErrorDisplay from "./ErrorDisplay";
import Screenshots from "./Screenshots";
import { TestBookingFlowResponse, TestError, TestStep } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface TestResultsProps {
  results: TestBookingFlowResponse;
}

export default function TestResults({ results }: TestResultsProps) {
  // Helper function to format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Test Results</span>
          <Badge variant={results.success ? "success" : "destructive"}>
            {results.success ? "Success" : "Failed"}
          </Badge>
        </CardTitle>
        <CardDescription>
          URL: {results.url} • Test ID: {results.testId} • Duration: {formatDuration(results.totalDuration)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <StatusIndicator status={results.demoFlowFound ? "success" : "failure"} />
              <span className="font-medium">Demo Flow Detection</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {results.demoFlowFound
                ? "Successfully found the 'Book a Demo' element"
                : "Could not find the 'Book a Demo' element"}
            </p>
          </div>
          <div className="flex flex-col p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <StatusIndicator status={results.bookingSuccessful ? "success" : "failure"} />
              <span className="font-medium">Booking Process</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {results.bookingSuccessful
                ? "Successfully completed the booking process"
                : "Could not complete the booking process"}
            </p>
          </div>
        </div>

        <Tabs defaultValue="steps">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="steps">Test Steps</TabsTrigger>
            <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
          </TabsList>
          
          <TabsContent value="steps" className="space-y-4 mt-4">
            {results.steps.map((step, index) => (
              <StepCard key={index} step={step} index={index} />
            ))}
            
            {results.customStepsResults && results.customStepsResults.length > 0 && (
              <>
                {results.customStepsResults.map((step, index) => (
                  <Card key={`custom-${index}`} className="overflow-hidden">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <StatusIndicator 
                          status={step.status || (step.success ? "success" : "failure")} 
                          size="sm" 
                        />
                        <span>Step {results.steps.length + index + 1}: {step.instruction}</span>
                      </CardTitle>
                    </CardHeader>
                    {step.llmDecision && (
                      <CardContent className="pb-0 pt-0">
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="llm-decision">
                            <AccordionTrigger className="text-sm py-2">
                              LLM Decision Details
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 text-sm">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="font-semibold">Action:</div>
                                  <div>{step.llmDecision.action}</div>
                                  <div className="font-semibold">Confidence:</div>
                                  <div>{step.llmDecision.confidence}%</div>
                                </div>
                                <div className="pt-2">
                                  <div className="font-semibold">Reasoning:</div>
                                  <div className="mt-1 text-muted-foreground">{step.llmDecision.reasoning}</div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </CardContent>
                    )}
                    {step.error && (
                      <CardContent className="pb-4">
                        <div className="bg-destructive/10 p-2 rounded text-sm text-destructive">
                          <div className="font-semibold">Error:</div>
                          <div>{step.error}</div>
                        </div>
                      </CardContent>
                    )}
                    {step.screenshot && (
                      <CardFooter className="p-0">
                        <img 
                          src={step.screenshot} 
                          alt={`Screenshot for step ${results.steps.length + index + 1}`} 
                          className="w-full object-contain max-h-64"
                        />
                      </CardFooter>
                    )}
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="screenshots" className="mt-4">
            <Screenshots steps={results.steps} customSteps={results.customStepsResults} />
          </TabsContent>
        </Tabs>

        {results.errors.length > 0 && (
          <div className="pt-4">
            <ErrorDisplay errors={results.errors} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StepCardProps {
  step: TestStep;
  index: number;
}

function StepCard({ step, index }: StepCardProps) {
  const getIcon = () => {
    switch (step.status) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "failure":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "running":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return null;
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3">
        <CardTitle className="text-base flex items-center gap-2">
          {getIcon()}
          <span>Step {index + 1}: {step.name}</span>
          {step.duration && <span className="text-xs text-muted-foreground ml-auto">{step.duration}ms</span>}
        </CardTitle>
      </CardHeader>
      {step.error && (
        <CardContent className="py-0">
          <div className="bg-destructive/10 p-2 rounded text-sm text-destructive">
            {step.error}
          </div>
        </CardContent>
      )}
      {step.llmDecision && (
        <CardContent className="pb-0 pt-0">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="llm-decision">
              <AccordionTrigger className="text-sm py-2">
                LLM Decision Details
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="font-semibold">Action:</div>
                    <div>{step.llmDecision.action}</div>
                    <div className="font-semibold">Confidence:</div>
                    <div>{step.llmDecision.confidence}%</div>
                  </div>
                  <div className="pt-2">
                    <div className="font-semibold">Reasoning:</div>
                    <div className="mt-1 text-muted-foreground">{step.llmDecision.reasoning}</div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      )}
      {step.screenshot && (
        <CardFooter className="p-0">
          <img 
            src={step.screenshot} 
            alt={`Screenshot for step ${index + 1}: ${step.name}`} 
            className="w-full object-contain max-h-64"
          />
        </CardFooter>
      )}
    </Card>
  );
} 