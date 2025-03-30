"use client";

import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface StatusIndicatorProps {
  status: "success" | "failure" | "running";
  size?: number | "sm" | "md" | "lg";
}

export default function StatusIndicator({ status, size = "md" }: StatusIndicatorProps) {
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
} 