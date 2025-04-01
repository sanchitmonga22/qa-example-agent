/**
 * Base LLM Service
 * Abstract class that defines the interface for LLM integration
 */

import { ElementSelection, FormFieldIdentification, LLMDecision, PageState, VisionAnalysisResult } from "../types";

export abstract class BaseLLMService {
  /**
   * Identifies an element to click based on the current page state and instruction
   * @param pageState The current state of the page
   * @param instruction The action instruction (e.g., "Click the Book a Demo button")
   */
  abstract getElementToClick(
    pageState: PageState,
    instruction: string
  ): Promise<ElementSelection>;

  /**
   * Identifies form fields and suggests appropriate values to enter
   * @param pageState The current state of the page with form fields
   */
  abstract identifyFormFields(
    pageState: PageState
  ): Promise<FormFieldIdentification[]>;

  /**
   * Determines the next action to take based on the current page state
   * @param pageState The current state of the page
   * @param currentStep The current test step being executed
   * @param previousActions Previous actions taken
   */
  abstract determineNextAction(
    pageState: PageState,
    currentStep: string,
    previousActions?: LLMDecision[]
  ): Promise<LLMDecision>;

  /**
   * Parses a natural language test step into a structured action
   * @param step The natural language test step
   */
  abstract parseTestStep(step: string): Promise<{
    action: string;
    target?: string;
    value?: string;
    description: string;
  }>;

  /**
   * Validates if a page contains confirmation elements
   * @param pageState The current state of the page
   */
  abstract validateConfirmation(pageState: PageState): Promise<{
    isConfirmation: boolean;
    confidence: number;
    reasoning: string;
  }>;

  /**
   * Analyzes before and after screenshots to determine if the requested action was successful
   * @param beforeScreenshot Base64 encoded before screenshot
   * @param afterScreenshot Base64 encoded after screenshot
   * @param instruction The user instruction for this step
   */
  abstract analyzeScreenshots(
    beforeScreenshot: string,
    afterScreenshot: string,
    instruction: string
  ): Promise<VisionAnalysisResult>;

  /**
   * Utility method to build context from page state
   * @param pageState The current state of the page
   */
  protected buildContext(pageState: PageState): string {
    // Base implementation - can be overridden by concrete classes
    return `
Page Title: ${pageState.title}
URL: ${pageState.url}
Number of Elements: ${pageState.elements.length}
Timestamp: ${pageState.timestamp}
    `;
  }

  /**
   * Utility method to format page elements for LLM prompt
   * @param pageState The current state of the page
   */
  protected formatElementsForPrompt(pageState: PageState): string {
    return pageState.elements
      .filter(el => el.visible)
      .map((el, index) => {
        return `
Element ${index + 1}:
  Tag: ${el.tag}
  Type: ${el.type || 'N/A'}
  ID: ${el.id || 'N/A'}
  Classes: ${el.classes?.join(', ') || 'N/A'}
  Text: ${el.text || 'N/A'}
  Placeholder: ${el.placeholder || 'N/A'}
  Position: x=${el.rect.x.toFixed(0)}, y=${el.rect.y.toFixed(0)}, width=${el.rect.width.toFixed(0)}, height=${el.rect.height.toFixed(0)}
        `;
      })
      .join('\n');
  }
} 