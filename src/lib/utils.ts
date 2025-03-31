import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { LLMFeedback } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a test ID with a random component
 */
export function generateTestId(): string {
  return `test-${Math.floor(Math.random() * 10000000000)}`;
}

/**
 * Format duration in milliseconds to a readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Parse LLM feedback text into structured format
 */
export function parseLLMFeedback(feedback?: string): LLMFeedback | undefined {
  if (!feedback) return undefined;
  
  const rawFeedback = feedback.trim();
  
  // Check if feedback starts with PASS or FAIL
  if (rawFeedback.startsWith('PASS:') || rawFeedback.startsWith('PASS ')) {
    const reason = rawFeedback.replace(/^PASS:?\s*/i, '').trim();
    return {
      status: 'PASS',
      reason,
      rawFeedback
    };
  } else if (rawFeedback.startsWith('FAIL:') || rawFeedback.startsWith('FAIL ')) {
    const reason = rawFeedback.replace(/^FAIL:?\s*/i, '').trim();
    return {
      status: 'FAIL',
      reason,
      rawFeedback
    };
  }
  
  // If no explicit status, try to infer from content
  const containsFailure = /fail(ed|ure)|error|not\s+(found|visible|complete|perform)/i.test(rawFeedback);
  
  return {
    status: containsFailure ? 'FAIL' : 'PASS',
    reason: rawFeedback,
    rawFeedback
  };
}
