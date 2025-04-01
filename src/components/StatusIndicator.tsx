"use client";

import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusIndicatorProps {
  status: "success" | "failure" | "running";
  size?: number | "sm" | "md" | "lg";
  label?: string;
}

export default function StatusIndicator({ status, size = "md", label }: StatusIndicatorProps) {
  const getSize = (): number => {
    if (typeof size === "number") return size;
    
    switch (size) {
      case "sm": return 16;
      case "lg": return 24;
      case "md":
      default: return 20;
    }
  };

  const sizeValue = getSize();
  
  const icon = (() => {
    switch (status) {
      case "success":
        return <CheckCircle className="text-success" size={sizeValue} />;
      case "failure":
        return <XCircle className="text-destructive" size={sizeValue} />;
      case "running":
        return <Loader2 className="text-warning animate-spin" size={sizeValue} />;
      default:
        return null;
    }
  })();
  
  // If there's a label, render the icon with the label
  if (label) {
    return (
      <div className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
        status === "success" && "bg-success/20 text-success border border-success/30",
        status === "failure" && "bg-destructive/10 text-destructive",
        status === "running" && "bg-warning/10 text-warning-foreground"
      )}>
        {icon}
        <span>{label}</span>
      </div>
    );
  }
  
  // Otherwise just return the icon
  return icon;
} 