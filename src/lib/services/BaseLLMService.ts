/**
 * Base LLM Service
 * Abstract class that defines the interface for LLM integration
 */

import { ElementSelection, FormFieldIdentification, LLMDecision, PageState } from "../types";

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
   * Validates the result of an action based on visual feedback
   * @param pageState The current state of the page after the action
   * @param instruction The original instruction
   * @param previousAction The action that was just executed
   * @param actionSuccess Whether the action was successfully executed
   */
  abstract validateActionResult(
    pageState: PageState,
    instruction: string,
    previousAction: LLMDecision,
    actionSuccess: boolean
  ): Promise<{
    isComplete: boolean;
    isSuccess: boolean;
    feedback: string;
  }>;

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
   * Format elements list for the LLM prompt
   * @param pageState The page state with elements to format
   * @returns Formatted string representation of elements
   */
  protected formatElementsForPrompt(pageState: PageState): string {
    return pageState.elements.slice(0, 20).map((element, index) => {
      return `${index + 1}. <${element.tag}> ${element.text || ''}`;
    }).join('\n');
  }
} 