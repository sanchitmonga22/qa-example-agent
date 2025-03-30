"use client";

import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

type StatusType = "running" | "success" | "failure" | "idle";

interface StatusIndicatorProps {
  status: StatusType;
  className?: string;
  size?: number;
}

export default function StatusIndicator({ 
  status, 
  className = "", 
  size = 24 
}: StatusIndicatorProps) {
  const baseClass = "inline-flex items-center";
  
  const statusConfig = {
    idle: {
      icon: <AlertCircle size={size} className="text-gray-400" />,
      text: "Ready",
      textColor: "text-gray-500"
    },
    running: {
      icon: <Loader2 size={size} className="text-blue-500 animate-spin" />,
      text: "Running",
      textColor: "text-blue-700"
    },
    success: {
      icon: <CheckCircle size={size} className="text-green-500" />,
      text: "Success",
      textColor: "text-green-700"
    },
    failure: {
      icon: <XCircle size={size} className="text-red-500" />,
      text: "Failed",
      textColor: "text-red-700"
    }
  };

  const { icon, text, textColor } = statusConfig[status];

  return (
    <div className={`${baseClass} ${className} gap-2 items-center`}>
      {icon}
      <span className={`font-medium ${textColor}`}>{text}</span>
    </div>
  );
} 