"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { useLoggerStore, uiLogger } from "@/lib/logger";

// Define the form schema with Zod
const formSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .startsWith("http", "URL must start with http:// or https://"),
  customSteps: z.array(z.string()).optional(),
  headless: z.boolean().default(true),
  detailedLogging: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface UrlInputFormProps {
  onSubmit: (url: string, customSteps?: string[], options?: { headless?: boolean, detailedLogging?: boolean }) => Promise<void>;
  isLoading?: boolean;
}

export default function UrlInputForm({ onSubmit, isLoading = false }: UrlInputFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [customSteps, setCustomSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("");
  const { enabled: loggerEnabled, setEnabled: setLoggerEnabled } = useLoggerStore();

  // Pre-populate default test steps on component mount
  useEffect(() => {
    setCustomSteps([
      "Click on the \"Book a Demo\" button",
      "Select a date from the calendar",
      "Select a time from the calendar",
      "Fill out the contact form with random information(name: Sanchit Monga, email: sanchitmonga22@gmail.com, phone: 5858314795, company: PrependAI, job title: Founder) and submit"
    ]);
    
    if (loggerEnabled) {
      uiLogger.debug("UrlInputForm mounted with default steps");
    }
  }, [loggerEnabled]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      customSteps: [],
      headless: true,
      detailedLogging: loggerEnabled,
    },
  });

  // Sync form value with logger store
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.detailedLogging !== undefined) {
        setLoggerEnabled(value.detailedLogging);
        if (value.detailedLogging) {
          uiLogger.info("Detailed logging enabled by user");
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, setLoggerEnabled]);

  const handleSubmit = async (values: FormValues) => {
    try {
      setError(null);
      
      if (values.detailedLogging) {
        uiLogger.info("Form submitted", {
          url: values.url,
          stepsCount: customSteps.length,
          headless: values.headless
        });
      }
      
      await onSubmit(
        values.url, 
        customSteps.length > 0 ? customSteps : undefined, 
        { 
          headless: values.headless,
          detailedLogging: values.detailedLogging
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      
      if (values.detailedLogging) {
        uiLogger.error("Form submission error", { error: errorMessage });
      }
    }
  };

  const addCustomStep = () => {
    if (currentStep.trim()) {
      setCustomSteps([...customSteps, currentStep.trim()]);
      setCurrentStep("");
      
      if (loggerEnabled) {
        uiLogger.debug("Custom step added", { stepCount: customSteps.length + 1 });
      }
    }
  };

  const removeCustomStep = (index: number) => {
    if (loggerEnabled) {
      uiLogger.debug("Custom step removed", { 
        index,
        step: customSteps[index]
      });
    }
    
    setCustomSteps(customSteps.filter((_, i) => i !== index));
  };

  const updateCustomStep = (index: number, value: string) => {
    const updatedSteps = [...customSteps];
    const oldValue = updatedSteps[index];
    updatedSteps[index] = value;
    setCustomSteps(updatedSteps);
    
    if (loggerEnabled) {
      uiLogger.debug("Custom step updated", { 
        index,
        oldValue,
        newValue: value
      });
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Landing Page URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://example.com"
                    {...field}
                    disabled={isLoading}
                    className="w-full"
                  />
                </FormControl>
                <FormDescription>
                  Enter the URL of the landing page you want to test
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="headless"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Headless Mode</FormLabel>
                  <FormDescription>
                    Turn off to watch the browser actions in real-time
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="detailedLogging"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel>Detailed Logging</FormLabel>
                  <FormDescription>
                    Enable to capture detailed logs during test execution
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="custom-steps">
              <AccordionTrigger>Test Steps</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <FormDescription>
                    Edit, remove or add test steps to validate your website interactions
                  </FormDescription>
                  
                  {customSteps.length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <ul className="space-y-2">
                          {customSteps.map((step, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <span className="font-medium">{index + 1}.</span>
                              <Input 
                                value={step}
                                onChange={(e) => updateCustomStep(index, e.target.value)}
                                disabled={isLoading}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCustomStep(index)}
                                disabled={isLoading}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                  
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter a new test step..."
                      value={currentStep}
                      onChange={(e) => setCurrentStep(e.target.value)}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={addCustomStep}
                      disabled={isLoading || !currentStep.trim()}
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Testing..." : "Run Test"}
          </Button>
        </form>
      </Form>
    </div>
  );
} 