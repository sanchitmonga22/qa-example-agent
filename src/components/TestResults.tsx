"use client";

import { useRef, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/utils";
import StatusIndicator from "@/components/StatusIndicator";
import Screenshots from "@/components/Screenshots";
import { TestWebsiteResponse, TestError, TestStep } from "@/lib/types";
import { CheckCircle, FileDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { generateTestResultsPDF, getValidImageUrl, isValidScreenshot } from "@/lib/pdfUtils";
import { LoggerPanel } from "@/components/LoggerPanel";
import { useLoggerStore, uiLogger, testLogger, llmLogger, visionLogger, initializeTestLogging } from "@/lib/logger";

interface TestResultsProps {
  results: TestWebsiteResponse;
}

export default function TestResults({ results }: TestResultsProps) {
  // Check if there are any completed custom steps
  const hasCustomSteps = results.customStepsResults && results.customStepsResults.length > 0;
  const reportRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { enabled: loggingEnabled } = useLoggerStore();
  
  // Log test results and detailed LLM/Vision data when the component mounts
  useEffect(() => {
    if (loggingEnabled) {
      const cleanupLogging = initializeTestLogging(results.testId, results.url);
      
      testLogger.info(`Test results loaded: ${results.success ? 'SUCCESS' : 'FAILURE'}`, {
        testId: results.testId,
        success: results.success,
        primaryCTAFound: results.primaryCTAFound,
        interactionSuccessful: results.interactionSuccessful,
        duration: results.totalDuration,
        stepsCount: results.steps.length,
        customStepsCount: results.customStepsResults?.length || 0,
        errorsCount: results.errors.length
      });
      
      // Log all standard steps
      results.steps.forEach((step, index) => {
        testLogger.info(`Standard step ${index + 1}: ${step.name} - ${step.status}`, {
          duration: step.duration,
          hasScreenshot: !!step.screenshot,
          hasError: !!step.error
        });
        
        // Log LLM decisions if available
        if (step.llmDecision) {
          llmLogger.logLLMDecision(step.llmDecision, step.name);
        }
        
        // Log errors if any
        if (step.error) {
          testLogger.error(`Error in step ${index + 1} (${step.name})`, step.error);
        }
      });
      
      // Log all custom steps
      if (hasCustomSteps && results.customStepsResults) {
        results.customStepsResults.forEach((step, index) => {
          testLogger.info(`Custom step ${index + 1}: ${step.instruction} - ${step.status}`, {
            success: step.success,
            hasScreenshot: !!step.screenshot,
            hasError: !!step.error,
            hasLLMDecision: !!step.llmDecision,
            hasVisionAnalysis: !!step.visionAnalysis
          });
          
          // Log LLM decisions if available
          if (step.llmDecision) {
            llmLogger.logLLMDecision(step.llmDecision, step.instruction);
          }
          
          // Log Vision API analysis if available
          if (step.visionAnalysis) {
            visionLogger.logVisionAnalysis(step.visionAnalysis, step.instruction);
          }
          
          // Log errors if any
          if (step.error) {
            testLogger.error(`Error in custom step ${index + 1}`, step.error);
          }
        });
      }
      
      // Log all errors
      if (results.errors.length > 0) {
        results.errors.forEach((error, index) => {
          testLogger.error(`Global error ${index + 1}: ${error.step}`, {
            message: error.message,
            details: error.details
          });
        });
      }

      return () => {
        if (cleanupLogging) cleanupLogging();
      };
    }
  }, [results, loggingEnabled, hasCustomSteps]);

  // Function to handle PDF export
  const exportAsPDF = async () => {
    if (!reportRef.current) return;
    
    if (loggingEnabled) {
      uiLogger.info(`Starting PDF export for test ${results.testId}`);
    }
    
    await generateTestResultsPDF(
      results,
      reportRef.current,
      () => {
        toast({
          title: "Generating PDF...",
          description: "Please wait while we prepare your report"
        });
        if (loggingEnabled) {
          uiLogger.debug(`PDF generation started`);
        }
      },
      () => {
        toast({
          title: "PDF Generated!",
          description: "Your report has been downloaded",
          variant: "success"
        });
        if (loggingEnabled) {
          uiLogger.info(`PDF successfully generated and downloaded`);
        }
      },
      (error) => {
        toast({
          title: "Error generating PDF",
          description: "Please try again later",
          variant: "destructive"
        });
        if (loggingEnabled) {
          uiLogger.error(`PDF generation failed`, error);
        }
      }
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="font-bold text-xl text-gray-900">Test Results</span>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="flex items-center gap-1" 
            onClick={exportAsPDF}
          >
            <FileDown className="h-4 w-4" />
            Export as PDF
          </Button>
          {results.success ? (
            <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-200">
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Passed
            </Badge>
          ) : (
            <StatusIndicator 
              status="failure" 
              label="Failed" 
            />
          )}
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        URL: {results.url} • Test ID: {results.testId} • Duration: {formatDuration(results.totalDuration)}
      </div>
      
      <div ref={reportRef} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">CTA Detection</CardTitle>
                {results.primaryCTAFound ? (
                  <div className="flex items-center rounded-full bg-green-100 p-1">
                    <StatusIndicator status="success" />
                  </div>
                ) : (
                  <StatusIndicator status="failure" />
                )}
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
                {results.interactionSuccessful ? (
                  <div className="flex items-center rounded-full bg-green-100 p-1">
                    <StatusIndicator status="success" />
                  </div>
                ) : (
                  <StatusIndicator status="failure" />
                )}
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
                <div className="space-y-3">
                  {results.customStepsResults!.map((step, index) => (
                    <Card key={index} className="border overflow-hidden">
                      <CardHeader className="pb-2 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="mr-1">{index + 1}</Badge>
                            <CardTitle className="text-base">{step.instruction}</CardTitle>
                          </div>
                          <StatusIndicator 
                            status={step.success ? "success" : "failure"} 
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="py-3">
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="details" className="border-none">
                            <AccordionTrigger className="py-1 text-sm accordion-trigger">
                              View LLM Decision Details
                            </AccordionTrigger>
                            <AccordionContent>
                              {step.llmDecision ? (
                                <div className="rounded-md border p-3 bg-gray-50 text-sm space-y-2">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <div className="font-medium text-gray-700">Action:</div>
                                    <div>{step.llmDecision.action}</div>
                                    
                                    <div className="font-medium text-gray-700">Confidence:</div>
                                    <div>{step.llmDecision.confidence}%</div>
                                    
                                    {step.llmDecision.value && (
                                      <>
                                        <div className="font-medium text-gray-700">Value:</div>
                                        <div>{step.llmDecision.value}</div>
                                      </>
                                    )}
                                  </div>
                                  
                                  <div>
                                    <div className="font-medium text-gray-700 mb-1">Reasoning:</div>
                                    <div className="p-2 bg-white rounded border text-xs whitespace-pre-wrap">
                                      {step.llmDecision.reasoning}
                                    </div>
                                  </div>
                                  
                                  {step.llmDecision.explanation && (
                                    <div>
                                      <div className="font-medium text-gray-700 mb-1">Explanation:</div>
                                      <div className="p-2 bg-white rounded border text-xs">
                                        {step.llmDecision.explanation}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {step.llmDecision.targetElement && (
                                    <div>
                                      <div className="font-medium text-gray-700 mb-1">Target Element:</div>
                                      <div className="p-2 bg-white rounded border text-xs">
                                        <div>Tag: {step.llmDecision.targetElement.tag}</div>
                                        {step.llmDecision.targetElement.id && 
                                          <div>ID: {step.llmDecision.targetElement.id}</div>}
                                        {step.llmDecision.targetElement.text && 
                                          <div>Text: {step.llmDecision.targetElement.text}</div>}
                                        {step.llmDecision.targetElement.classes && step.llmDecision.targetElement.classes.length > 0 && 
                                          <div>Classes: {step.llmDecision.targetElement.classes.join(', ')}</div>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-muted-foreground text-sm italic">No decision details available</div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                          
                          {step.visionAnalysis && (
                            <AccordionItem value="vision-analysis" className="border-none">
                              <AccordionTrigger className="py-1 text-sm accordion-trigger">
                                View Vision API Analysis
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="rounded-md border p-3 bg-gray-50 text-sm space-y-2">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <div className="font-medium text-gray-700">Status:</div>
                                    <div className="flex items-center">
                                      <StatusIndicator 
                                        status={step.visionAnalysis.isPassed ? "success" : "failure"}
                                        label={step.visionAnalysis.isPassed ? "Passed" : "Failed"}
                                      />
                                    </div>
                                    
                                    <div className="font-medium text-gray-700">Confidence:</div>
                                    <div>{step.visionAnalysis.confidence}%</div>
                                  </div>
                                  
                                  <div>
                                    <div className="font-medium text-gray-700 mb-1">Visual Analysis:</div>
                                    <div className="p-2 bg-white rounded border text-xs whitespace-pre-wrap">
                                      {step.visionAnalysis.reasoning}
                                    </div>
                                  </div>
                                  
                                  {step.visionAnalysis.beforeScreenshot && step.visionAnalysis.afterScreenshot && (
                                    <div>
                                      <div className="font-medium text-gray-700 mb-1">Before & After:</div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="p-1 bg-white rounded border">
                                          <div className="text-xs text-center mb-1 text-gray-500">Before</div>
                                          {isValidScreenshot(step.visionAnalysis.beforeScreenshot) ? (
                                            <img 
                                              src={getValidImageUrl(step.visionAnalysis.beforeScreenshot)} 
                                              alt="Before" 
                                              className="max-h-48 mx-auto rounded border"
                                            />
                                          ) : (
                                            <div className="text-xs text-muted-foreground italic text-center">
                                              No screenshot available
                                            </div>
                                          )}
                                        </div>
                                        <div className="p-1 bg-white rounded border">
                                          <div className="text-xs text-center mb-1 text-gray-500">After</div>
                                          {isValidScreenshot(step.visionAnalysis.afterScreenshot) ? (
                                            <img 
                                              src={getValidImageUrl(step.visionAnalysis.afterScreenshot)} 
                                              alt="After" 
                                              className="max-h-48 mx-auto rounded border"
                                            />
                                          ) : (
                                            <div className="text-xs text-muted-foreground italic text-center">
                                              No screenshot available
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )}
                        </Accordion>
                                
                        {step.error && (
                          <Alert variant="destructive" className="mt-3">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-xs">
                              {step.error}
                            </AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                      {isValidScreenshot(step.screenshot) && (
                        <CardFooter className="p-0 border-t">
                          <img
                            src={getValidImageUrl(step.screenshot)}
                            alt={`Screenshot for step ${index + 1}`}
                            className="w-full max-h-60 object-contain"
                            crossOrigin="anonymous"
                          />
                        </CardFooter>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold mb-2">Test Steps</h3>
                <div className="space-y-3">
                  {results.steps.map((step: TestStep, index) => (
                    <Card key={index} className="border overflow-hidden">
                      <CardHeader className="pb-2 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="mr-1">{index + 1}</Badge>
                            <CardTitle className="text-base">
                              {step.name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </CardTitle>
                          </div>
                          <StatusIndicator status={step.status} />
                        </div>
                        <CardDescription>
                          Duration: {formatDuration(step.duration || 0)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="py-3">
                        {step.llmDecision && (
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="details" className="border-none">
                              <AccordionTrigger className="py-1 text-sm accordion-trigger">
                                View LLM Decision Details
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="rounded-md border p-3 bg-gray-50 text-sm space-y-2">
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <div className="font-medium text-gray-700">Action:</div>
                                    <div>{step.llmDecision.action}</div>
                                    
                                    <div className="font-medium text-gray-700">Confidence:</div>
                                    <div>{step.llmDecision.confidence}%</div>
                                    
                                    {step.llmDecision.value && (
                                      <>
                                        <div className="font-medium text-gray-700">Value:</div>
                                        <div>{step.llmDecision.value}</div>
                                      </>
                                    )}
                                  </div>
                                  
                                  <div>
                                    <div className="font-medium text-gray-700 mb-1">Reasoning:</div>
                                    <div className="p-2 bg-white rounded border text-xs whitespace-pre-wrap">
                                      {step.llmDecision.reasoning}
                                    </div>
                                  </div>
                                  
                                  {step.llmDecision.explanation && (
                                    <div>
                                      <div className="font-medium text-gray-700 mb-1">Explanation:</div>
                                      <div className="p-2 bg-white rounded border text-xs">
                                        {step.llmDecision.explanation}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {step.llmDecision.targetElement && (
                                    <div>
                                      <div className="font-medium text-gray-700 mb-1">Target Element:</div>
                                      <div className="p-2 bg-white rounded border text-xs">
                                        <div>Tag: {step.llmDecision.targetElement.tag}</div>
                                        {step.llmDecision.targetElement.id && 
                                          <div>ID: {step.llmDecision.targetElement.id}</div>}
                                        {step.llmDecision.targetElement.text && 
                                          <div>Text: {step.llmDecision.targetElement.text}</div>}
                                        {step.llmDecision.targetElement.classes && step.llmDecision.targetElement.classes.length > 0 && 
                                          <div>Classes: {step.llmDecision.targetElement.classes.join(', ')}</div>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                        
                        {step.error && (
                          <Alert variant="destructive" className="mt-3">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription className="text-xs whitespace-pre-wrap">{step.error}</AlertDescription>
                          </Alert>
                        )}
                      </CardContent>
                      {isValidScreenshot(step.screenshot) && (
                        <CardFooter className="p-0 border-t">
                          <img
                            src={getValidImageUrl(step.screenshot)}
                            alt={`Screenshot for step ${index + 1}`}
                            className="w-full max-h-60 object-contain"
                            crossOrigin="anonymous"
                          />
                        </CardFooter>
                      )}
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
                      <AccordionTrigger className="text-destructive accordion-trigger">
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

        {/* Logger Panel */}
        {loggingEnabled && <LoggerPanel />}
      </div>
    </div>
  );
} 