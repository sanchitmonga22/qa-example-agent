/**
 * OpenAI Service Implementation
 * Concrete implementation of BaseLLMService using OpenAI API
 */

import { BaseLLMService } from "./BaseLLMService";
import { ElementSelection, FormFieldIdentification, LLMDecision, PageState, VisionAnalysisResult } from "../types";
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
    const systemPrompt = `You are an expert web testing assistant that precisely follows instructions to automate web interactions.
Your task is to determine the next action to take based on the current page state and test progress.
You must keep executing actions until the current step is FULLY complete, and you must explicitly indicate when you believe the step is complete.

For contact or booking forms, complete all available fields and submit the form.
A complete interaction typically involves:
1. Filling all required fields (name, email, message, etc.)
2. Filling any optional fields when appropriate
3. Final form submission by clicking a submit button

IMPORTANT: Only report step completion when you are CERTAIN the goal has been achieved.`;
    
    const previousActionsText = previousActions && previousActions.length > 0 ? 
      `Previous actions taken for this step (${previousActions.length} total):\n${previousActions.map((a, i) => 
        `${i+1}. Action: ${a.action}${a.targetElement ? ` on element ${a.targetElement.tag}${a.targetElement.text ? ` with text "${a.targetElement.text}"` : ''}` : ''}${a.value ? ` with value "${a.value}"` : ''}\n   Result: ${a.reasoning.includes('Error:') ? 'FAILED - ' + a.reasoning.split('Error:')[1].trim() : 'SUCCESS'}`).join('\n')}` : 
      'No previous actions taken for this step yet.';
    
    const prompt = `
Current test step to complete: "${currentStep}"

${previousActionsText}

Current page state:
Title: ${pageState.title}
URL: ${pageState.url}

Available elements (${pageState.elements.length} total):
${this.formatElementsForPrompt(pageState)}

Based on the current test step "${currentStep}" and your actions so far, determine what to do next.

${previousActions && previousActions.length > 0 ? 
  `Is this step complete? If YES, use 'verify' action and include "step complete" in your reasoning.
If NO, what is the next logical action to complete this step?` : 
  `What is the first action needed to begin completing this step?`}

Respond with a JSON object containing:
1. action: The action to perform (click, type, select, wait, submit, verify, hover, check, press)
2. targetElementId: The element to target (use the element number, required for all actions except wait and press)
3. value: Any value to enter (required for type, select, check, press actions)
4. confidence: Your confidence in this action (0-100)
5. reasoning: Brief explanation of your decision, including whether you believe the step is now complete
`;

    try {
      const response = await this.makeRequest(prompt, systemPrompt);
      const parsedResponse = this.extractJSONFromResponse(response);
      
      const targetElementId = parsedResponse.targetElementId || "1";
      const targetElementIndex = parseInt(targetElementId) - 1;
      
      // Determine if the step is complete based on the reasoning
      const isComplete = parsedResponse.reasoning ? (
        parsedResponse.reasoning.toLowerCase().includes('step complete') ||
        parsedResponse.reasoning.toLowerCase().includes('goal complete') ||
        parsedResponse.reasoning.toLowerCase().includes('task complete') ||
        parsedResponse.reasoning.toLowerCase().includes('form submitted') ||
        parsedResponse.reasoning.toLowerCase().includes('form completed')
      ) : false;
      
      return {
        action: parsedResponse.action || 'click',
        targetElement: pageState.elements[targetElementIndex >= 0 && targetElementIndex < pageState.elements.length ? targetElementIndex : 0],
        value: parsedResponse.value,
        confidence: Number(parsedResponse.confidence || 50),
        reasoning: parsedResponse.reasoning || "No reasoning provided",
        isComplete: isComplete
      };
    } catch (error) {
      console.error("Failed to determine next action:", error);
      return {
        action: 'click',
        targetElement: pageState.elements[0],
        confidence: 0,
        reasoning: `Failed to parse LLM response: ${error instanceof Error ? error.message : String(error)}`,
        isComplete: false
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

  /**
   * Analyzes before and after screenshots to determine if the requested action was successful
   * @param beforeScreenshot Base64 encoded before screenshot
   * @param afterScreenshot Base64 encoded after screenshot
   * @param instruction The user instruction for this step
   */
  async analyzeScreenshots(
    beforeScreenshot: string,
    afterScreenshot: string,
    instruction: string
  ): Promise<VisionAnalysisResult> {
    try {
      // Helper function to properly format image URLs for the API
      const formatImageUrl = (base64String: string) => {
        // If it already has a data URL prefix, extract just the base64 content
        if (base64String.startsWith('data:')) {
          const parts = base64String.split(',');
          if (parts.length > 1) {
            base64String = parts[1];
          }
        }
        
        // Return a properly formatted data URL with PNG format
        return `data:image/png;base64,${base64String}`;
      };

      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert web testing assistant. Your task is to analyze before and after screenshots 
            of a web page to determine if a requested user action was successfully executed. 
            Provide detailed reasoning about visual changes and whether the action appears to have succeeded or failed.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze these before and after screenshots of a webpage where the following user action was attempted:
                
                "${instruction}"
                
                Determine if the action was successfully completed based on visual evidence. Look for:
                1. Element state changes (buttons, forms, etc.)
                2. Page navigation or content changes
                3. Error messages or confirmations
                4. Progress indicators
                
                Respond with a JSON object containing:
                1. isPassed: Boolean indicating if the action succeeded
                2. confidence: Number between 0-100 indicating your confidence
                3. reasoning: Detailed explanation of your determination based on visual evidence`
              },
              {
                type: "image_url",
                image_url: {
                  url: formatImageUrl(beforeScreenshot),
                  detail: "high"
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: formatImageUrl(afterScreenshot),
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.2
      });
      
      const content = response.choices[0]?.message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI Vision API");
      }
      
      const parsedResponse = this.extractJSONFromResponse(content);
      
      return {
        isPassed: Boolean(parsedResponse.isPassed),
        confidence: Number(parsedResponse.confidence || 50),
        reasoning: parsedResponse.reasoning || "No reasoning provided",
        beforeScreenshot,
        afterScreenshot
      };
    } catch (error) {
      console.error("Failed to analyze screenshots with Vision API:", error);
      return {
        isPassed: false,
        confidence: 0,
        reasoning: `Failed to analyze with Vision API: ${error instanceof Error ? error.message : String(error)}`,
        beforeScreenshot,
        afterScreenshot
      };
    }
  }
} 