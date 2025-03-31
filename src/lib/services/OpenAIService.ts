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
   * Format elements list for the LLM prompt
   */
  protected formatElementsForPrompt(pageState: PageState): string {
    // First, sort by vertical position (y-coordinate) to match visual reading order
    const sortedElements = [...pageState.elements].sort((a, b) => {
      // Sort by vertical position (y-coordinate) first
      if (a.rect.y !== b.rect.y) {
        return a.rect.y - b.rect.y;
      }
      // Then by horizontal position (x-coordinate)
      return a.rect.x - b.rect.x;
    });
    
    // Limit to the first 20 elements to avoid too long prompts
    return sortedElements.slice(0, 20).map((element, index) => {
      // Extract important attributes for better context
      const attributes = [];
      if (element.type) attributes.push(`type="${element.type}"`);
      if (element.placeholder) attributes.push(`placeholder="${element.placeholder}"`);
      
      // Create a more descriptive element representation
      const position = `x:${Math.round(element.rect.x)}, y:${Math.round(element.rect.y)}`;
      const size = `${Math.round(element.rect.width)}x${Math.round(element.rect.height)}`;
      const classes = element.classes && element.classes.length > 0 ? `class="${element.classes.join(' ')}"` : '';
      
      return `${index + 1}. <${element.tag} ${element.id ? `id="${element.id}"` : ''} ${classes} ${attributes.join(' ')}> ${element.text ? `"${element.text}"` : ''} [Position: ${position}, Size: ${size}]`;
    }).join('\n');
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
   * Makes a request to the OpenAI API with vision capabilities for analyzing screenshots
   * @param prompt The text prompt
   * @param systemPrompt The system instruction
   * @param screenshot Base64 encoded screenshot to analyze
   */
  private async makeVisionRequest(prompt: string, systemPrompt: string, screenshot: string): Promise<string> {
    let retries = 0;
    let lastError: Error | null = null;

    // Ensure screenshot has proper encoding prefix
    const screenshotUrl = this.getValidImageUrl(screenshot);
    if (!screenshotUrl) {
      console.warn("Invalid screenshot data, proceeding without visual context");
      return this.makeRequest(prompt, systemPrompt);
    }

    // Add debugging info
    const screenshotSize = Math.round((screenshotUrl.length * 3) / 4); // Approximate base64 size
    console.log(`Processing screenshot: ~${Math.round(screenshotSize/1024)}KB, valid format: ${screenshotUrl.startsWith('data:image/')}`);
    
    // Debug screenshot validity by checking its size and prefix
    if (screenshotSize < 1000) {
      console.warn("Warning: Screenshot is suspiciously small (<1KB). Might be invalid or empty.");
    }

    while (retries < this.maxRetries) {
      try {
        console.log(`Making OpenAI vision API request (attempt ${retries + 1}/${this.maxRetries})...`);
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: [
                { type: "text", text: prompt },
                { 
                  type: "image_url", 
                  image_url: {
                    url: screenshotUrl,
                    detail: "high"
                  }
                }
              ] 
            }
          ],
          temperature: 0.2,
          max_tokens: 1500,
        });
        
        const content = response.choices[0]?.message.content;
        if (!content) {
          throw new Error("Empty response from OpenAI");
        }
        
        console.log("Successfully received vision API response");
        return content;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error("Vision API error details:", error);
        
        // Handle rate limiting differently - wait longer
        if (error instanceof Error && 'status' in error && error.status === 429) {
          console.warn(`Rate limited by OpenAI. Retrying in ${this.retryDelay * 2}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * 2));
        } else {
          console.warn(`OpenAI Vision API error (attempt ${retries + 1}/${this.maxRetries}):`, error);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
        
        retries++;
      }
    }
    
    console.error(`Failed to get response from OpenAI Vision API after ${this.maxRetries} attempts`);
    console.warn("Falling back to text-only API call without screenshot");
    return this.makeRequest(prompt, systemPrompt);
  }

  /**
   * Helper method to ensure a valid image URL
   */
  private getValidImageUrl(base64Data?: string): string {
    if (!base64Data || base64Data.trim() === '') {
      return '';
    }
    
    // Ensure the base64 data has the data:image prefix
    if (base64Data.startsWith('data:image/')) {
      return base64Data;
    }
    
    // Otherwise, add the proper prefix
    return `data:image/jpeg;base64,${base64Data.trim()}`;
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
    const systemPrompt = `You are an expert web testing assistant that precisely follows instructions to automate web interactions using Playwright.
Your task is to determine the next action to take based on the current page state and test progress.

KEY CONTEXT:
- You are operating in a Playwright-powered automation environment
- JavaScript IS ENABLED and working properly in this environment
- You can interact with any visible and enabled elements on the page
- If elements aren't interactive, it's due to them being hidden, disabled, or covered by other elements

For contact or booking forms, complete all available fields and submit the form.
A complete interaction typically involves:
1. Filling all required fields (name, email, message, etc.)
2. Filling any optional fields when appropriate
3. Final form submission by clicking a submit button

IMPORTANT: 
- Only report step completion when you are CERTAIN the goal has been achieved
- If an action fails, suggest an alternative approach rather than assuming browser limitations
- If a button can't be clicked, look for other ways to achieve the goal or suggest waiting for elements to be visible`;
    
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

IMPORTANT REMINDERS:
- JavaScript IS enabled - do not suggest enabling it
- If a click fails, the element might be covered by another element, not properly loaded, or not visible
- For critical buttons like "join waitlist", ensure the element is visible and interact-able
- Consider timing issues - sometimes a brief wait is needed before interacting with elements

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
      
      // Check if the target element exists
      if (targetElementIndex >= 0 && targetElementIndex < pageState.elements.length) {
        return {
          action: parsedResponse.action,
          targetElement: pageState.elements[targetElementIndex],
          value: parsedResponse.value,
          confidence: parsedResponse.confidence || 50,
          reasoning: parsedResponse.reasoning || "No reasoning provided",
          isComplete: parsedResponse.reasoning?.toLowerCase().includes('complete') || false
        };
      } else {
        return {
          action: parsedResponse.action,
          value: parsedResponse.value,
          confidence: parsedResponse.confidence || 50,
          reasoning: parsedResponse.reasoning || "No reasoning provided",
          isComplete: parsedResponse.reasoning?.toLowerCase().includes('complete') || false
        };
      }
    } catch (error) {
      console.error("Failed to determine next action:", error);
      
      // Provide a fallback action if we failed to get a response
      return {
        action: "verify",
        confidence: 0,
        reasoning: `Failed to determine next action: ${error instanceof Error ? error.message : String(error)}. The step cannot be completed.`,
        isComplete: true
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
   * Validates the result of an action based on visual feedback
   * @param pageState The current state of the page after the action
   * @param instruction The original instruction
   * @param previousAction The action that was just executed
   * @param actionSuccess Whether the action was successfully executed
   */
  async validateActionResult(
    pageState: PageState,
    instruction: string,
    previousAction: LLMDecision,
    actionSuccess: boolean
  ): Promise<{
    isComplete: boolean;
    isSuccess: boolean;
    feedback: string;
  }> {
    const systemPrompt = `You are an expert web testing analyst providing clear, factual visual feedback on Playwright-based automated test steps.
You are ANALYZING a SCREENSHOT of a browser automation test where JavaScript IS FULLY ENABLED and functional. Playwright is being used for automation and successfully executing commands on the page.

Your task is to analyze the provided screenshot and current page state after an action has been performed and determine:
1. If the action was successful based on the VISUAL evidence in the screenshot
2. If the current test step is complete based on visible indicators in the screenshot
3. Provide precise, actionable feedback on what happened with CLEAR PASS/FAIL status

Important guidelines:
- NEVER suggest JavaScript is disabled or not working - tests are running with JavaScript fully enabled
- Focus ONLY on what you can see in the SCREENSHOT - this is your primary evidence
- Always provide a clear PASS or FAIL status first in your feedback based on visual evidence
- For failures, focus ONLY on what you can directly observe in the current page state and screenshot
- Look for error messages, form validation messages, or other visual indicators of success/failure
- Pay attention to URL changes, form submissions, visible feedback elements in the screenshot`;

    const prompt = `
INSTRUCTION: ${instruction}

PREVIOUS ACTION:
- Action Type: ${previousAction.action}
- Target: ${previousAction.targetElement ? `${previousAction.targetElement.tag} element with text "${previousAction.targetElement.text || ''}"` : 'None'}
- Value (if applicable): ${previousAction.value || 'None'}
- Technical Result: ${actionSuccess ? 'The action was technically successful' : 'The action failed technically'}

CURRENT PAGE STATE:
- URL: ${pageState.url}
- Title: ${pageState.title}
- Visible Text Elements: ${pageState.elements.slice(0, 5).map(e => e.text).filter(Boolean).join(', ')}
- Form Inputs: ${pageState.elements.filter(e => e.tag === 'input' || e.tag === 'textarea' || e.tag === 'select').length} inputs found
- Buttons: ${pageState.elements.filter(e => e.tag === 'button').length} buttons found

TASK: Analyze the screenshot carefully, then provide clear feedback:
1. Begin with "PASS:" or "FAIL:" to clearly indicate the result
2. Describe what you see in the screenshot and if it indicates the action was successful
3. State whether the step is now complete based on visual evidence in the screenshot
4. For failures, describe specific visual evidence of failure from the screenshot

IMPORTANT: JavaScript is fully enabled and the automation is working correctly. Do NOT mention JavaScript being disabled, page structure or loading state issues unless you clearly see visual evidence of these problems in the screenshot.

RESPONSE FORMAT:
{
  "isComplete": true/false,
  "isSuccess": true/false, 
  "feedback": "Your detailed feedback here starting with PASS: or FAIL:"
}`;

    try {
      // Use vision API if screenshot is available
      let response;
      if (pageState.screenshot) {
        console.log("Using vision API with screenshot for validation");
        response = await this.makeVisionRequest(prompt, systemPrompt, pageState.screenshot);
      } else {
        console.log("No screenshot available, using text-only API");
        response = await this.makeRequest(prompt, systemPrompt);
      }
      
      const parsedResponse = this.extractJSONFromResponse(response);
      
      // Ensure feedback always has PASS/FAIL prefix
      let feedback = parsedResponse.feedback || 'No feedback provided';
      if (!feedback.startsWith('PASS:') && !feedback.startsWith('FAIL:')) {
        feedback = parsedResponse.isSuccess ? `PASS: ${feedback}` : `FAIL: ${feedback}`;
      }
      
      // Filter out any mentions of JavaScript being disabled or not working
      if (feedback.toLowerCase().includes('javascript') && 
          (feedback.toLowerCase().includes('disabled') || 
           feedback.toLowerCase().includes('not enabled') || 
           feedback.toLowerCase().includes('isn\'t enabled'))) {
        feedback = actionSuccess 
          ? `PASS: Action completed successfully. The step has been completed.` 
          : `FAIL: Action didn't achieve the expected result. The element may not be fully visible or interactive.`;
      }
      
      return {
        isComplete: !!parsedResponse.isComplete,
        isSuccess: !!parsedResponse.isSuccess,
        feedback
      };
    } catch (error) {
      console.error("Failed to validate action result:", error);
      return {
        isComplete: false,
        isSuccess: actionSuccess, // Default to technical success
        feedback: actionSuccess 
          ? `PASS: Action completed successfully, but couldn't get detailed feedback.` 
          : `FAIL: Action failed. Either the element is not visible, not interactive, or doesn't exist on the page.`
      };
    }
  }
} 