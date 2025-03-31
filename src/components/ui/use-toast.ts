// Adapted from shadcn-ui toast component
import * as React from "react";
import { toast, type ToasterProps } from "sonner";

type ToastActionElement = React.ReactNode;

type ToasterToast = {
  id?: string;
  title?: string;
  description?: string;
  action?: ToastActionElement;
  variant?: "default" | "destructive" | "success";
};

const actionTypes = {
  default: toast,
  destructive: toast.error,
  success: toast.success,
};

export function useToast() {
  function showToast({
    id = `toast-${Date.now()}`,
    title,
    description,
    action,
    variant = "default",
    ...props
  }: ToasterToast) {
    const toastFunction = actionTypes[variant] || toast;
    
    toastFunction(title, {
      id,
      description,
      action,
      ...props,
    });
  }

  return {
    toast: showToast,
  };
} 