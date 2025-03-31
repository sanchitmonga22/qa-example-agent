"use client";

import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusIndicatorProps {
  status: "success" | "failure" | "running";
  size?: number | "sm" | "md" | "lg";
  label?: string;
  variant?: "default" | "badge";
}

export default function StatusIndicator({ 
  status, 
  size = "md", 
  label, 
  variant = "default" 
}: StatusIndicatorProps) {
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
        return <CheckCircle className="text-green-600" size={sizeValue} />;
      case "failure":
        return <XCircle className="text-red-600" size={sizeValue} />;
      case "running":
        return <Loader2 className="text-amber-600 animate-spin" size={sizeValue} />;
      default:
        return null;
    }
  })();
  
  // If variant is badge or there's a label, render with badge style
  if (variant === "badge" || label) {
    return (
      <div className={cn(
        "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
        status === "success" && "bg-green-100 text-green-700 border border-green-300",
        status === "failure" && "bg-red-100 text-red-700 border border-red-300",
        status === "running" && "bg-amber-100 text-amber-700 border border-amber-300"
      )}>
        {icon}
        {label && <span>{label}</span>}
      </div>
    );
  }
  
  // For default variant with container
  if (variant === "default") {
    return (
      <div className={cn(
        "flex items-center justify-center rounded-full p-1",
        status === "success" && "bg-green-100",
        status === "failure" && "bg-red-100",
        status === "running" && "bg-amber-100"
      )}>
        {icon}
      </div>
    );
  }
  
  // Otherwise just return the icon
  return icon;
} 