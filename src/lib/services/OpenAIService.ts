/**
 * OpenAI Service Implementation
 * Concrete implementation of BaseLLMService using OpenAI API
 */

import { BaseLLMService } from "./BaseLLMService";
import { ElementSelection, FormFieldIdentification, LLMDecision, PageState } from "../types";
import OpenAI from "openai";

export class OpenAIService extends BaseLLMService {
  private client: OpenAI;
  private model: string = "gpt-4o";
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(apiKey: string) {
    super();
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Makes a request to the OpenAI API with retry logic
   * @param prompt The prompt to send
   * @param systemPrompt The system instruction
   */
  private async makeRequest(prompt: string, systemPrompt: string): Promise<string> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.maxRetries) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 1500,
        });
        
        const content = response.choices[0]?.message.content;
        if (!content) {
          throw new Error("Empty response from OpenAI");
        }
        
        return content;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Handle rate limiting differently - wait longer
        if (error instanceof Error && 'status' in error && error.status === 429) {
          console.warn(`Rate limited by OpenAI. Retrying in ${this.retryDelay * 2}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * 2));
        } else {
          console.warn(`OpenAI API error (attempt ${retries + 1}/${this.maxRetries}):`, error);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
        
        retries++;
      }
    }
    
    console.error(`Failed to get response from OpenAI after ${this.maxRetries} attempts`);
    throw lastError || new Error("Failed to get response from OpenAI");
  }

  /**
   * Helper method to extract JSON from a string response
   * Sometimes the LLM includes markdown or text around the JSON
   */
  private extractJSONFromResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (innerError) {
          console.error("Failed to parse JSON from code block:", innerError);
        }
      }
      
      // Try to find anything that looks like JSON with curly braces
      const bracesMatch = response.match(/\{[\s\S]*\}/);
      if (bracesMatch) {
        try {
          return JSON.parse(bracesMatch[0]);
        } catch (innerError) {
          console.error("Failed to parse JSON from braces match:", innerError);
        }
      }
      
      throw new Error("Could not extract valid JSON from response");
    }
  }

  /**
   * Identifies an element to click based on the current page state and instruction
   * @param pageState The current state of the page
   * @param instruction The action instruction
   */
  async getElementToClick(
    pageState: PageState,
    instruction: string
  ): Promise<ElementSelection> {
    const systemPrompt = `You are an expert web testing assistant. Your task is to identify the best element to click based on the instruction and page state provided.`;
    
    const prompt = `
Given the current page state and elements, identify the best element to click that matches this description:
"${instruction}"

Page Title: ${pageState.title}
URL: ${pageState.url}

Available elements:
${this.formatElementsForPrompt(pageState)}

Respond with a JSON object containing:
1. elementId: The ID of the element to click (use the element number)
2. confidence: Your confidence level (0-100)
3. reasoning: Brief explanation of why you chose this element
`;

    try {
      const response = await this.makeRequest(prompt, systemPrompt);
      const parsedResponse = this.extractJSONFromResponse(response);
      
      return {
        elementId: String(parsedResponse.elementId || "1"),
        confidence: Number(parsedResponse.confidence || 50),
        reasoning: parsedResponse.reasoning || "No reasoning provided"
      };
    } catch (error) {
      console.error("Failed to identify element to click:", error);
      return {
        elementId: "1",
        confidence: 0,
        reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Identifies form fields and suggests appropriate values to enter
   * @param pageState The current state of the page with form fields
   */
  async identifyFormFields(
    pageState: PageState
  ): Promise<FormFieldIdentification[]> {
    const systemPrompt = `You are an expert web testing assistant. Your task is to identify form fields and determine what test data should be entered.`;
    
    const prompt = `
Analyze this form and identify the purpose of each input field.

Form elements:
${this.formatElementsForPrompt(pageState)}

For each input field, determine:
1. fieldType: The semantic purpose (name, email, phone, company, message, job-title, other)
2. valueToUse: Appropriate test data to enter
3. confidence: Your confidence in this identification (0-100)

Respond with a JSON array of field identifications.
`;

    try {
      const response = await this.makeRequest(prompt, systemPrompt);
      const parsedResponse = this.extractJSONFromResponse(response);
      
      if (Array.isArray(parsedResponse)) {
        return parsedResponse.map(field => ({
          fieldType: field.fieldType || 'other',
          valueToUse: field.valueToUse || 'Test Data',
          confidence: Number(field.confidence || 50)
        }));
      }
      
      throw new Error("Response is not an array");
    } catch (error) {
      console.error("Failed to identify form fields:", error);
      return [];
    }
  }

  /**
   * Determines the next action to take based on the current page state
   * @param pageState The current state of the page
   * @param currentStep The current test step being executed
   * @param previousActions Previous actions taken
   */
  async determineNextAction(
    pageState: PageState,
    currentStep: string,
    previousActions?: LLMDecision[]
  ): Promise<LLMDecision> {
    const systemPrompt = `You are an expert web testing assistant. Your task is to determine the next action to take based on the current page state and test progress.`;
    
    const previousActionsText = previousActions ? 
      `Previous actions:\n${previousActions.map((a, i) => 
        `${i+1}. ${a.action} - ${a.reasoning}`).join('\n')}` : 
      'No previous actions.';
    
    const prompt = `
Based on the current state of the page and the test progress, determine the next action to take.

Current test step: "${currentStep}"

${previousActionsText}

Current page state:
Title: ${pageState.title}
URL: ${pageState.url}

Available elements:
${this.formatElementsForPrompt(pageState)}

Respond with a JSON object containing:
1. action: The action to perform (click, type, select, wait, submit, verify)
2. targetElementId: The element to target (use the element number)
3. value: Any value to enter (for input fields)
4. confidence: Your confidence in this action (0-100)
5. reasoning: Brief explanation of your decision
`;

    try {
      const response = await this.makeRequest(prompt, systemPrompt);
      const parsedResponse = this.extractJSONFromResponse(response);
      
      const targetElementId = parsedResponse.targetElementId || "1";
      const targetElementIndex = parseInt(targetElementId) - 1;
      
      return {
        action: parsedResponse.action || 'click',
        targetElement: pageState.elements[targetElementIndex >= 0 ? targetElementIndex : 0],
        value: parsedResponse.value,
        confidence: Number(parsedResponse.confidence || 50),
        reasoning: parsedResponse.reasoning || "No reasoning provided"
      };
    } catch (error) {
      console.error("Failed to determine next action:", error);
      return {
        action: 'click',
        targetElement: pageState.elements[0],
        confidence: 0,
        reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Parses a natural language test step into a structured action
   * @param step The natural language test step
   */
  async parseTestStep(step: string): Promise<{
    action: string;
    target?: string;
    value?: string;
    description: string;
  }> {
    const systemPrompt = `You are an expert web testing assistant. Your task is to parse a natural language test step into a structured action.`;
    
    const prompt = `
Parse the following test step into a structured action:
"${step}"

Respond with a JSON object containing:
1. action: The action to perform (click, type, select, wait, submit, verify)
2. target: The target element description (if applicable)
3. value: Any value to enter (for input fields)
4. description: A clear description of the action
`;

    try {
      const response = await this.makeRequest(prompt, systemPrompt);
      const parsedResponse = this.extractJSONFromResponse(response);
      
      return {
        action: parsedResponse.action || 'click',
        target: parsedResponse.target,
        value: parsedResponse.value,
        description: parsedResponse.description || step
      };
    } catch (error) {
      console.error("Failed to parse test step:", error);
      return {
        action: 'click',
        description: step
      };
    }
  }

  /**
   * Validates if a page contains confirmation elements
   * @param pageState The current state of the page
   */
  async validateConfirmation(pageState: PageState): Promise<{
    isConfirmation: boolean;
    confidence: number;
    reasoning: string;
  }> {
    const systemPrompt = `You are an expert web testing assistant. Your task is to determine if the current page is a confirmation or thank you page after submitting a form.`;
    
    const prompt = `
Analyze this page and determine if it appears to be a confirmation or thank you page after submitting a form.

Page Title: ${pageState.title}
URL: ${pageState.url}

Page elements:
${this.formatElementsForPrompt(pageState)}

Respond with a JSON object containing:
1. isConfirmation: Boolean indicating if this is a confirmation page
2. confidence: Your confidence level (0-100)
3. reasoning: Brief explanation of your decision
`;

    try {
      const response = await this.makeRequest(prompt, systemPrompt);
      const parsedResponse = this.extractJSONFromResponse(response);
      
      return {
        isConfirmation: Boolean(parsedResponse.isConfirmation || false),
        confidence: Number(parsedResponse.confidence || 50),
        reasoning: parsedResponse.reasoning || "No reasoning provided"
      };
    } catch (error) {
      console.error("Failed to validate confirmation:", error);
      return {
        isConfirmation: false,
        confidence: 0,
        reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
} 