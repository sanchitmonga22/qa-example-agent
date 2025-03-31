"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Plus, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Define the form schema with Zod
const formSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL" }),
  customSteps: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UrlInputFormProps {
  onSubmit: (url: string, customSteps?: string[], options?: { headless: boolean }) => Promise<void>;
  isLoading?: boolean;
}

export default function UrlInputForm({ onSubmit, isLoading = false }: UrlInputFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [customSteps, setCustomSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [headless, setHeadless] = useState<boolean>(true);

  // Pre-populate default test steps on component mount
  useEffect(() => {
    setCustomSteps([
      "Click on the \"Book a Demo\" button",
      "Select a date from the calendar",
      "Select a time from the calendar",
      "Fill out the contact form with random information(name: Sanchit Monga, email: sanchitmonga22@gmail.com, phone: 9876543210, company: PrependAI, job title: Founder) and submit"
    ]);
  }, []);

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
      await onSubmit(
        values.url, 
        customSteps.length > 0 ? customSteps : undefined,
        { headless }
      );
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
    <div className="mx-auto p-6 bg-white shadow-sm rounded-lg">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Landing Page URL</FormLabel>
                <FormControl>
                  <div className="flex">
                    <Input placeholder="https://example.com" {...field} />
                    <Button 
                      disabled={isLoading} 
                      type="submit" 
                      className="ml-2 min-w-[120px]"
                    >
                      {isLoading ? (
                        <span className="flex items-center">
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          Testing
                        </span>
                      ) : "Run Test"}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="mt-4 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox 
                id="headless" 
                checked={headless} 
                onCheckedChange={(checked: boolean) => setHeadless(checked)} 
              />
              <Label htmlFor="headless">Run in headless mode (uncheck to see the browser)</Label>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="text-md mb-4 font-medium">Custom Test Steps</h3>
            <div className="space-y-4">
              {customSteps.map((step, index) => (
                <div key={index} className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Input
                      value={step}
                      onChange={(e) => updateCustomStep(index, e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeCustomStep(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
  
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Add a new test step..."
                    value={currentStep}
                    onChange={(e) => setCurrentStep(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomStep();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCustomStep}
                >
                  Add Step
                </Button>
              </div>
            </div>
          </div>
  
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>
      </Form>
    </div>
  );
} 