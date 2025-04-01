/**
 * Logger utility for detailed application logging
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LLMDecision, VisionAnalysisResult } from '@/lib/types';

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  details?: any;
}

// Logger store interface
interface LoggerState {
  enabled: boolean;
  logs: LogEntry[];
  setEnabled: (enabled: boolean) => void;
  addLog: (entry: Omit<LogEntry, 'timestamp'>) => void;
  logLLMDecision: (decision: LLMDecision, stepName: string) => void;
  logVisionAnalysis: (analysis: VisionAnalysisResult, stepName: string) => void;
  clearLogs: () => void;
  exportLogs: () => string;
}

// Create logger store with persistent storage
export const useLoggerStore = create<LoggerState>()(
  persist(
    (set, get) => ({
      enabled: false,
      logs: [],
      setEnabled: (enabled: boolean) => set({ enabled }),
      addLog: (entry: Omit<LogEntry, 'timestamp'>) => {
        if (!get().enabled) return;
        
        const timestamp = new Date().toISOString();
        const fullEntry = {
          ...entry,
          timestamp
        };
        
        // Log to console when enabled
        if (get().enabled) {
          const formattedTime = new Date(timestamp).toLocaleTimeString();
          const prefix = `[${formattedTime}] [${entry.level}] [${entry.category}]`;
          
          switch (entry.level) {
            case LogLevel.DEBUG:
              console.debug(prefix, entry.message, entry.details || '');
              break;
            case LogLevel.INFO:
              console.info(prefix, entry.message, entry.details || '');
              break;
            case LogLevel.WARN:
              console.warn(prefix, entry.message, entry.details || '');
              break;
            case LogLevel.ERROR:
              console.error(prefix, entry.message, entry.details || '');
              break;
            default:
              console.log(prefix, entry.message, entry.details || '');
          }
        }
        
        set((state: LoggerState) => ({
          logs: [
            ...state.logs,
            fullEntry
          ]
        }));
      },
      logLLMDecision: (decision: LLMDecision, stepName: string) => {
        if (!get().enabled) return;
        
        const { action, confidence, value, reasoning, targetElement } = decision;
        
        // Log the LLM decision
        const logDetails = {
          action,
          confidence,
          targetElement: targetElement ? {
            tag: targetElement.tag,
            type: targetElement.type,
            id: targetElement.id,
            text: targetElement.text,
            classes: targetElement.classes
          } : null,
          value,
        };
        
        // Main log entry
        get().addLog({
          level: LogLevel.INFO,
          category: 'LLM',
          message: `Decision for step "${stepName}": ${action} with ${confidence}% confidence`,
          details: logDetails
        });
        
        // Reasoning as separate debug entry
        if (reasoning) {
          get().addLog({
            level: LogLevel.DEBUG,
            category: 'LLM',
            message: `Reasoning for "${stepName}" decision:`,
            details: reasoning
          });
        }
        
        // Additional explanation if present
        if (decision.explanation) {
          get().addLog({
            level: LogLevel.DEBUG,
            category: 'LLM',
            message: `Explanation for "${stepName}" decision:`,
            details: decision.explanation
          });
        }
        
        // Target element details for click/interaction actions
        if (targetElement && ['click', 'type', 'select'].includes(action)) {
          get().addLog({
            level: LogLevel.DEBUG,
            category: 'LLM',
            message: `Target element for "${stepName}":`,
            details: targetElement
          });
        }
      },
      logVisionAnalysis: (analysis: VisionAnalysisResult, stepName: string) => {
        if (!get().enabled) return;
        
        const { isPassed, confidence, reasoning } = analysis;
        
        // Main log entry
        get().addLog({
          level: isPassed ? LogLevel.INFO : LogLevel.WARN,
          category: 'Vision',
          message: `Vision analysis for "${stepName}": ${isPassed ? 'PASSED' : 'FAILED'} with ${confidence}% confidence`,
          details: { isPassed, confidence }
        });
        
        // Reasoning as separate debug entry
        if (reasoning) {
          get().addLog({
            level: LogLevel.DEBUG,
            category: 'Vision',
            message: `Reasoning for "${stepName}" analysis:`,
            details: reasoning
          });
        }
      },
      clearLogs: () => set({ logs: [] }),
      exportLogs: () => {
        const { logs } = get();
        return JSON.stringify(logs, null, 2);
      }
    }),
    {
      name: 'app-logger-storage'
    }
  )
);

// Logger utility class
class Logger {
  private category: string;

  constructor(category: string) {
    this.category = category;
  }

  debug(message: string, details?: any) {
    this.log(LogLevel.DEBUG, message, details);
  }

  info(message: string, details?: any) {
    this.log(LogLevel.INFO, message, details);
  }

  warn(message: string, details?: any) {
    this.log(LogLevel.WARN, message, details);
  }

  error(message: string, details?: any) {
    this.log(LogLevel.ERROR, message, details);
  }

  // Log LLM decision
  logLLMDecision(decision: LLMDecision, stepName: string) {
    useLoggerStore.getState().logLLMDecision(decision, stepName);
  }

  // Log Vision API analysis
  logVisionAnalysis(analysis: VisionAnalysisResult, stepName: string) {
    useLoggerStore.getState().logVisionAnalysis(analysis, stepName);
  }

  private log(level: LogLevel, message: string, details?: any) {
    useLoggerStore.getState().addLog({
      level,
      category: this.category,
      message,
      details
    });
  }
}

// Export logger factory function
export const createLogger = (category: string): Logger => {
  return new Logger(category);
};

// Initialize logging for a test session
export const initializeTestLogging = (testId: string, url: string) => {
  const { enabled } = useLoggerStore.getState();
  
  if (!enabled) return;
  
  testLogger.info(`Starting new test session`, { testId, url });
  console.group(`Test Session: ${testId}`);
  
  // Log system info
  testLogger.debug('System information', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timestamp: new Date().toISOString(),
  });
  
  // Return a cleanup function
  return () => {
    testLogger.info(`Test session completed`, { testId });
    console.groupEnd();
  };
};

// Export pre-defined loggers for different components
export const pdfLogger = createLogger('PDFUtils');
export const testLogger = createLogger('TestSystem');
export const apiLogger = createLogger('API');
export const uiLogger = createLogger('UI');
export const browserLogger = createLogger('Browser');
export const llmLogger = createLogger('LLM');
export const visionLogger = createLogger('Vision'); 