"use client";

import { useState } from "react";
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

// Define the form schema with Zod
const formSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .startsWith("http", "URL must start with http:// or https://"),
  customSteps: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UrlInputFormProps {
  onSubmit: (url: string, customSteps?: string[]) => Promise<void>;
  isLoading?: boolean;
}

export default function UrlInputForm({ onSubmit, isLoading = false }: UrlInputFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [customSteps, setCustomSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      customSteps: [],
    },
  });

  const handleSubmit = async (values: FormValues) => {
    try {
      setError(null);
      await onSubmit(values.url, customSteps.length > 0 ? customSteps : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  const addCustomStep = () => {
    if (currentStep.trim()) {
      setCustomSteps([...customSteps, currentStep.trim()]);
      setCurrentStep("");
    }
  };

  const removeCustomStep = (index: number) => {
    setCustomSteps(customSteps.filter((_, i) => i !== index));
  };

  const updateCustomStep = (index: number, value: string) => {
    const updatedSteps = [...customSteps];
    updatedSteps[index] = value;
    setCustomSteps(updatedSteps);
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

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="custom-steps">
              <AccordionTrigger>Custom Test Steps (Optional)</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <FormDescription>
                    Add custom test steps in natural language (e.g., "Click the Contact Us button")
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
            {isLoading ? "Testing..." : "Test Booking Flow"}
          </Button>
        </form>
      </Form>
    </div>
  );
} 