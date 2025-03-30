"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestError } from "@/lib/types";

interface ErrorDisplayProps {
  errors: TestError[];
  className?: string;
}

export default function ErrorDisplay({ errors, className = "" }: ErrorDisplayProps) {
  if (!errors || errors.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Test Failed</AlertTitle>
        <AlertDescription>
          {errors.length === 1 
            ? "An error occurred during testing" 
            : `${errors.length} errors occurred during testing`}
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {errors.map((error, index) => (
          <Card key={index} className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Error in step: {error.step}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-semibold">{error.message}</p>
              {error.details && (
                <p className="mt-1 text-gray-600">{error.details}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 