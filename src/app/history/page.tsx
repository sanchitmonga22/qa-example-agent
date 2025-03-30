"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusIndicator from "@/components/StatusIndicator";
import Link from "next/link";
import { TestHistoryItem } from "@/lib/types";

export default function HistoryPage() {
  const [testHistory, setTestHistory] = useState<TestHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTestHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/test-history');
        
        if (!response.ok) {
          throw new Error('Failed to fetch test history');
        }
        
        const data = await response.json();
        setTestHistory(data);
      } catch (error) {
        console.error('Error loading test history:', error);
        // Use empty array if error occurs
        setTestHistory([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTestHistory();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test History</h1>
        <p className="text-gray-600">View the results of your previous landing page tests</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-t-2 border-b-2 border-gray-900 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading test history...</p>
          </div>
        </div>
      ) : testHistory.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-gray-500 mb-4">You haven't run any tests yet</p>
            <Button asChild>
              <Link href="/">Run Your First Test</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {testHistory.map((test) => (
            <Card key={test.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-medium mb-1 truncate max-w-md">
                      {test.url}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(test.timestamp)}
                    </CardDescription>
                  </div>
                  <StatusIndicator status={test.success ? "success" : "failure"} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">Demo Flow:</span>
                    <StatusIndicator 
                      status={test.demoFlowFound ? "success" : "failure"} 
                      size={16} 
                    />
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">Booking Process:</span>
                    <StatusIndicator 
                      status={test.bookingSuccessful ? "success" : "failure"} 
                      size={16} 
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/history/${test.id}`}>View Details</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 