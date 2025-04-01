"use client";

import { useState, useEffect } from "react";
import { useLoggerStore, LogLevel, LogEntry } from "@/lib/logger";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Trash2, Terminal } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function LoggerPanel() {
  const { enabled, logs, clearLogs, exportLogs } = useLoggerStore();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [filteredLogs, setFilteredLogs] = useState(logs);

  // Filter logs when tab changes or logs update
  useEffect(() => {
    if (activeTab === "all") {
      setFilteredLogs(logs);
    } else {
      setFilteredLogs(logs.filter((log: LogEntry) => log.level === activeTab));
    }
  }, [logs, activeTab]);

  // Handle export logs click
  const handleExportLogs = () => {
    const json = exportLogs();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `app-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get log level badge color
  const getLevelBadgeColor = (level: LogLevel) => {
    switch (level) {
      case LogLevel.DEBUG:
        return "bg-muted text-muted-foreground";
      case LogLevel.INFO:
        return "bg-primary text-primary-foreground";
      case LogLevel.WARN:
        return "bg-warning text-warning-foreground";
      case LogLevel.ERROR:
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Format timestamp to readable time
  const formatTimeAgo = (timestamp: string) => {
    try {
      const logDate = new Date(timestamp);
      const now = new Date();
      
      // If timestamp is today, just show the time
      if (logDate.toDateString() === now.toDateString()) {
        return logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      
      // Otherwise show date and time
      return logDate.toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
      });
    } catch (error) {
      return "unknown time";
    }
  };

  if (!enabled) {
    return null;
  }

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          Application Logs
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={clearLogs}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          {logs.length} log entries. Showing detailed execution logs. Logs are also output to browser console.
        </CardDescription>
        <Alert className="mt-2">
          <Terminal className="h-4 w-4 mr-2" />
          <AlertDescription>
            Open your browser's developer console (F12 or Cmd+Option+I) to see all logs as they happen in real-time.
          </AlertDescription>
        </Alert>
      </CardHeader>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <div className="px-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value={LogLevel.DEBUG}>Debug</TabsTrigger>
            <TabsTrigger value={LogLevel.INFO}>Info</TabsTrigger>
            <TabsTrigger value={LogLevel.WARN}>Warning</TabsTrigger>
            <TabsTrigger value={LogLevel.ERROR}>Error</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="all" className="m-0">
          <CardContent className="p-4 max-h-96 overflow-y-auto space-y-2">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log: LogEntry, index: number) => (
                <div key={index} className="border-b border-border pb-2 mb-2 last:border-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge className={getLevelBadgeColor(log.level)}>
                      {log.level}
                    </Badge>
                    <span className="text-sm font-medium">{log.category}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm">{log.message}</p>
                  {log.details && (
                    <pre className="text-xs bg-muted/30 p-2 rounded mt-1 overflow-x-auto">
                      {typeof log.details === 'object' 
                        ? JSON.stringify(log.details, null, 2) 
                        : log.details.toString()}
                    </pre>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                No logs to display for this level
              </div>
            )}
          </CardContent>
        </TabsContent>
        
        {Object.values(LogLevel).map((level) => (
          <TabsContent key={level} value={level} className="m-0">
            <CardContent className="p-4 max-h-96 overflow-y-auto space-y-2">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log: LogEntry, index: number) => (
                  <div key={index} className="border-b border-border pb-2 mb-2 last:border-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge className={getLevelBadgeColor(log.level)}>
                        {log.level}
                      </Badge>
                      <span className="text-sm font-medium">{log.category}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.details && (
                      <pre className="text-xs bg-muted/30 p-2 rounded mt-1 overflow-x-auto">
                        {typeof log.details === 'object' 
                          ? JSON.stringify(log.details, null, 2) 
                          : log.details.toString()}
                      </pre>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No logs to display for this level
                </div>
              )}
            </CardContent>
          </TabsContent>
        ))}
      </Tabs>
      
      <CardFooter className="flex justify-between bg-muted/50 p-4">
        <div className="text-xs text-muted-foreground">
          {logs.length > 0 && (
            <>Latest log: {new Date(logs[logs.length - 1].timestamp).toLocaleString()}</>
          )}
        </div>
      </CardFooter>
    </Card>
  );
} 