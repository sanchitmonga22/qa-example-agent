# QA Test Agent - Architecture

## 1. System Overview

The QA Test Agent is a powerful web interaction testing tool that automatically navigates and validates user journeys on any website using AI-powered testing. The system consists of three main components:

1. **Next.js Frontend**: User interface for entering URLs, defining test steps, and viewing test results
2. **Next.js API Routes**: Handles requests and orchestrates testing
3. **Playwright Testing Service**: Executes browser automation with LLM guidance

## 2. Interaction Flow Sequence

The following sequence diagram illustrates the high-level flow of test execution, including the LLM feedback loop:

```
┌─────────┐          ┌─────────┐          ┌───────────┐          ┌─────────┐          ┌─────────────┐
│         │          │         │          │           │          │         │          │             │
│  User   │          │Frontend │          │API Routes │          │Playwright│          │LLM Service  │
│         │          │         │          │           │          │Service   │          │             │
└────┬────┘          └────┬────┘          └─────┬─────┘          └────┬────┘          └──────┬──────┘
     │                     │                     │                     │                      │
     │  1. Enter URL       │                     │                     │                      │
     │  & Test Steps       │                     │                     │                      │
     │ ──────────────────> │                     │                     │                      │
     │                     │                     │                     │                      │
     │                     │  2. Submit Test     │                     │                      │
     │                     │  Request            │                     │                      │
     │                     │ ──────────────────> │                     │                      │
     │                     │                     │                     │                      │
     │                     │                     │  3. Forward Test    │                      │
     │                     │                     │  Request            │                      │
     │                     │                     │ ──────────────────> │                      │
     │                     │                     │                     │                      │
     │                     │                     │                     │  4. Navigate to URL  │
     │                     │                     │                     │ ──────────────────>  │
     │                     │                     │                     │                      │
     │                     │                     │                     │  5. Extract Page     │
     │                     │                     │                     │  State               │
     │                     │                     │                     │ <──────────────────  │
     │                     │                     │                     │                      │
     │                     │                     │                     │  6. Send Page State  │
     │                     │                     │                     │  & Context           │
     │                     │                     │                     │ ──────────────────>  │
     │                     │                     │                     │                      │
     │                     │                     │                     │  7. Return Decision  │
     │                     │                     │                     │  (Element to         │
     │                     │                     │                     │  Interact With)      │
     │                     │                     │                     │ <──────────────────  │
     │                     │                     │                     │                      │
     │                     │                     │                     │  8. Execute Action   │
     │                     │                     │                     │ ──────────────────>  │
     │                     │                     │                     │                      │
     │                     │                     │                     │  9. Extract New      │
     │                     │                     │                     │  Page State          │
     │                     │                     │                     │ <──────────────────  │
     │                     │                     │                     │                      │
     │                     │                     │                     │                      │
     │                     │                     │                     │                      │
     │                     │                     │                 Steps 6-9 repeat in a feedback loop
     │                     │                     │                 until test is complete or fails
     │                     │                     │                     │                      │
     │                     │                     │                     │                      │
     │                     │                     │  10. Return Test    │                      │
     │                     │                     │  Results            │                      │
     │                     │                     │ <─────────────────  │                      │
     │                     │                     │                     │                      │
     │                     │  11. Return         │                     │                      │
     │                     │  Results            │                     │                      │
     │                     │ <─────────────────  │                     │                      │
     │                     │                     │                     │                      │
     │  12. View Results   │                     │                     │                      │
     │  & Export PDF       │                     │                     │                      │
     │ <─────────────────  │                     │                     │                      │
     │                     │                     │                     │                      │
┌────┴────┐          ┌────┴────┐          ┌─────┴─────┐          ┌────┴────┐          ┌──────┴──────┐
│         │          │         │          │           │          │         │          │             │
│  User   │          │Frontend │          │API Routes │          │Playwright│          │LLM Service  │
│         │          │         │          │           │          │Service   │          │             │
└─────────┘          └─────────┘          └───────────┘          └─────────┘          └─────────────┘
```

### Key Stages in the LLM Feedback Loop:

1. **Initial Navigation**: The Playwright service loads the target URL
2. **Page State Extraction**: DOM elements, structure, and visual information are extracted
3. **LLM Consultation**: Page state is sent to the LLM with context and instructions
4. **Decision Making**: LLM analyzes the page and recommends the next action
5. **Action Execution**: Playwright executes the recommended action (click, input, etc.)
6. **Result Capture**: New page state is captured and screenshots are taken
7. **Feedback Loop**: The new state is sent back to the LLM with previous context
8. **Continuation**: Steps 3-7 repeat until the test completes or fails

This intelligent feedback loop enables the system to adapt to different websites and UI patterns, making decisions based on the current state of the page and previous interactions.

## 3. High-Level Architecture

```
┌─────────────────┐         ┌────────────────────┐         ┌─────────────────────┐
│                 │         │                    │         │                     │
│  Next.js        │  HTTP   │  Next.js           │  HTTP   │  Playwright Testing │
│  Frontend       │────────►│  API Routes        │────────►│  Service with LLM   │
│  (Vercel)       │◄────────│  (Vercel)          │◄────────│  (Railway.app)      │
│                 │         │                    │         │                     │
└─────────────────┘         └────────────────────┘         └─────────────────────┘
       ▲                            ▲                              ▲
       │                            │                              │
       │                            │                              │
       │                            │                              │
       ▼                            ▼                              ▼
┌─────────────────┐         ┌────────────────────┐         ┌─────────────────────┐
│  UI Components  │         │ Request Processing │         │ Testing Components  │
│  • URL Input    │         │ • Validation       │         │ • DOM Interaction   │
│  • Test Results │         │ • Error Handling   │         │ • LLM Guidance      │
│  • Screenshots  │         │ • Test Orchestration│        │ • Browser Automation│
│  • PDF Export   │         │                    │         │                     │
└─────────────────┘         └────────────────────┘         └─────────────────────┘
```

## 4. Frontend Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                          │
│                                                                  │
│  ┌────────────────┐   ┌─────────────────┐   ┌────────────────┐   │
│  │                │   │                 │   │                │   │
│  │  URL Input     │──►│  Test Execution │──►│  Test Results  │   │
│  │  Component     │   │  State          │   │  Display       │   │
│  │                │   │                 │   │                │   │
│  └────────────────┘   └─────────────────┘   └────────────────┘   │
│                              │                      ▲             │
│                              │                      │             │
│                              ▼                      │             │
│  ┌────────────────┐   ┌─────────────────┐   ┌────────────────┐   │
│  │                │   │                 │   │                │   │
│  │  Custom Test   │──►│  API Service    │──►│  Screenshots   │   │
│  │  Steps Input   │   │  (API Calls)    │   │  Component     │   │
│  │                │   │                 │   │                │   │
│  └────────────────┘   └─────────────────┘   └────────────────┘   │
│                                                    │             │
│                                                    │             │
│                                                    ▼             │
│  ┌────────────────┐                                              │
│  │                │                                              │
│  │  PDF Export    │                                              │
│  │  Component     │                                              │
│  │                │                                              │
│  └────────────────┘                                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Key components:
- **URL Input Form**: Collects the landing page URL and optional custom test steps
- **Test Results Display**: Shows status, steps, screenshots, and errors
- **API Service**: Handles communication with backend
- **Screenshots Component**: Displays test progression visually 
- **Custom Test Steps**: Allows defining natural language test instructions
- **PDF Export**: Enables exporting test results as a comprehensive PDF report

## 5. Backend Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                           │
│                                                                  │
│  ┌────────────────┐   ┌─────────────────┐   ┌────────────────┐   │
│  │                │   │                 │   │                │   │
│  │  Request       │──►│  Validation &   │──►│  Playwright    │   │
│  │  Handler       │   │  Processing     │   │  Service Proxy │   │
│  │                │   │                 │   │                │   │
│  └────────────────┘   └─────────────────┘   └────────────────┘   │
│                                                    │             │
└────────────────────────────────────────────────────┼─────────────┘
                                                     │
                                                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Playwright Testing Service                     │
│                                                                  │
│  ┌────────────────┐   ┌─────────────────┐   ┌────────────────┐   │
│  │                │   │                 │   │                │   │
│  │  Test          │──►│  LLM Service    │──►│  Results       │   │
│  │  Orchestration │   │  Integration    │   │  Processor     │   │
│  │                │   │                 │   │                │   │
│  └────────────────┘   └─────────────────┘   └────────────────┘   │
│           │                    ▲                    ▲             │
│           │                    │                    │             │
│           ▼                    │                    │             │
│  ┌────────────────┐            │                    │             │
│  │                │            │                    │             │
│  │  DOM           │                                 │             │
│  │  Interaction   │─────────────────────────────────┘             │
│  │  Layer         │                                               │
│  └────────────────┘                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Key components:
- **API Routes**: Handle requests and proxy to testing service
- **Test Orchestration**: Controls the testing process flow
- **DOM Interaction Layer**: Provides generic interface for browser automation
- **LLM Service**: AI guidance for test navigation
- **Results Processor**: Formats and returns test results

## 6. Test Execution Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Landing Page   │────►│  Demo Button    │────►│  Demo Button    │
│  Load           │     │  Detection      │     │  Click          │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Confirmation   │◄────│  Form           │◄────│  Form Detection │
│  Check          │     │  Submission     │     │  & Filling      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐
│                 │
│  Results        │
│  Generation     │
│                 │
└─────────────────┘
```

## 7. LLM Integration and DOM Interaction

```
┌──────────────────────┐          ┌───────────────────────┐
│                      │          │                       │
│  DOM Interaction     │◄────────►│  LLM Decision Engine  │
│  Layer               │          │  (OpenAI API)         │
│                      │          │                       │
└──────────┬───────────┘          └───────────────────────┘
           │                                   ▲
           │                                   │
           ▼                                   │
┌──────────────────────┐          ┌───────────────────────┐
│                      │          │                       │
│  Page State          │─────────►│  Prompt Construction  │
│  Extraction          │          │  & Context Building   │
│                      │          │                       │
└──────────────────────┘          └───────────────────────┘
```

### DOM Interaction Layer

The DOM Interaction Layer is a key architectural component that:

1. **Provides a Technology-Agnostic Interface**
   - Abstract `BaseDOMInteractor` class defines a common interface
   - Concrete implementations (e.g., `PlaywrightDOMInteractor`) handle tool-specific details
   - Allows swapping automation tools without changing test logic

2. **Standardizes Element Interaction**
   - Defines all common DOM operations (click, fill, select, etc.)
   - Handles complex selector building and element discovery
   - Implements smart fallback mechanisms for finding elements

3. **Manages Error Handling**
   - Provides consistent error handling across all DOM operations
   - Captures and categorizes errors appropriately
   - Returns structured errors for better diagnostics

4. **Extracts Page State**
   - Gets interactable elements from the page
   - Captures screenshots
   - Provides page metadata for LLM context

The LLM integration enables intelligent navigation through:
1. Extracting page state via the DOM Interaction Layer
2. Sending this information to the LLM with appropriate context
3. Receiving action recommendations (which elements to click, what data to enter)
4. Executing those actions through the DOM Interaction Layer and capturing results

## 8. PDF Export Feature

```
┌────────────────────────────────────────────────────────────────┐
│                       PDF Export System                        │
│                                                                │
│  ┌────────────────┐   ┌─────────────────┐   ┌────────────────┐ │
│  │                │   │                 │   │                │ │
│  │  Test Results  │──►│  HTML to Canvas │──►│  Canvas to PDF │ │
│  │  Component     │   │  Conversion     │   │  Conversion    │ │
│  │                │   │                 │   │                │ │
│  └────────────────┘   └─────────────────┘   └────────────────┘ │
│                                                    │           │
│                                                    │           │
│                                                    ▼           │
│  ┌────────────────┐   ┌─────────────────┐   ┌────────────────┐ │
│  │                │   │                 │   │                │ │
│  │  Accordion     │   │  PDF            │   │  File          │ │
│  │  Management    │◄──┤  Generation     │◄──┤  Download      │ │
│  │                │   │  & Formatting   │   │  Trigger       │ │
│  └────────────────┘   └─────────────────┘   └────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Key components:
- **PDF Generation Utility**: Client-side PDF creation from test results
- **HTML to Canvas Conversion**: Captures DOM elements as images for PDF inclusion
- **Content Formatting**: Organizes test data in a readable PDF format
- **Element Management**: Handles expanding accordions for complete capture
- **Download Trigger**: Initiates browser download of the generated PDF

The PDF export feature leverages client-side JavaScript libraries (jsPDF and html2canvas) to create comprehensive test reports that include:
- Test metadata (URL, duration, test ID)
- Overall test status
- Step-by-step results with screenshots
- LLM decision details for each step
- Error information where applicable

This client-side approach ensures privacy and performance by generating the PDF directly in the user's browser without sending data to external servers.

## 9. API Specifications

### POST /api/test-website

**Request Body**:
```json
{
  "url": "https://example.com",
  "customSteps": [
    "Click on the login button",
    "Fill in the username field with 'test@example.com'",
    "Enter 'password123' in the password field",
    "Click the submit button",
    "Verify the dashboard is displayed"
  ]
}
```

**Response Body**:
```json
{
  "success": true,
  "testId": "test-123",
  "url": "https://example.com",
  "interactionSuccessful": true,
  "steps": [
    {
      "name": "Page Load",
      "status": "success",
      "duration": 1240,
      "screenshot": "base64-encoded-image",
      "llmDecision": {
        "action": "identify_element",
        "confidence": 95,
        "reasoning": "Looking for login button based on instruction...",
        "targetElement": {
          "tag": "button",
          "id": "login-btn",
          "text": "Log In",
          "classes": ["btn", "primary-button"]
        }
      }
    }
  ],
  "customStepsResults": [
    {
      "instruction": "Click on the login button",
      "success": true,
      "screenshot": "base64-encoded-image",
      "llmDecision": {
        "action": "click",
        "confidence": 90,
        "reasoning": "Identified button with text 'Log In'",
        "targetElement": {
          "tag": "button",
          "text": "Log In",
          "classes": ["btn", "primary-button"]
        }
      }
    }
  ],
  "totalDuration": 6390,
  "errors": []
}
```

## 10. Deployment Architecture

The system uses a hybrid deployment model:

1. **Next.js Frontend & API Routes**: Deployed on Vercel
   - Global CDN for fast asset delivery
   - Serverless functions for API routes
   - GitHub integration for CI/CD

2. **Playwright Testing Service**: Deployed on Railway.app
   - Containerized environment for browser automation
   - Sufficient resources for Playwright execution
   - Longer execution timeouts than serverless functions

This approach solves:
- Resource limitations of serverless functions
- Execution time constraints
- Browser automation environment requirements

## 11. Security & Monitoring

- **Input Validation**: URL validation to prevent injection attacks
- **Rate Limiting**: Protection against abuse
- **Error Handling**: Graceful degradation and detailed logging
- **Monitoring**: Performance metrics and error tracking

## 12. DOM Interaction Layer Details

### Structure

```
┌─────────────────────────────────────────────────────────────┐
│                     BaseDOMInteractor                       │
│                                                             │
│  • Abstract interface for all DOM operations                │
│  • Defines standard methods for element interaction         │
│  • Provides consistent return types and error patterns      │
│                                                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ implements
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  PlaywrightDOMInteractor                    │
│                                                             │
│  • Concrete implementation using Playwright                 │
│  • Handles selector building and element finding            │
│  • Implements error handling and logging                    │
│  • Extracts page state and element information              │
│                                                             │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ uses
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     BookingFlowTest                         │
│                                                             │
│  • Orchestrates testing process                             │
│  • Uses DOM Interactor for all browser interactions         │
│  • Integrates with LLM for decision making                  │
│  • Processes and returns test results                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **Flexible Element Representation**: The `InteractableElement` interface provides multiple ways to identify elements (id, classes, text, attributes, etc.)
- **Smart Selector Building**: Converts high-level element descriptions into effective selectors
- **Comprehensive API**: Covers all common DOM operations needed for testing
- **Error Resilience**: Each method returns a success indicator and handles errors appropriately
- **Screenshot Integration**: Built-in methods for capturing visual state

## 13. Conclusion

This architecture provides a scalable, reliable system for automated web interaction testing using AI-powered decision making. The QA Test Agent's separation of concerns between the Next.js frontend/API, the DOM Interaction Layer, and the LLM decision engine enables efficient resource utilization and a high degree of flexibility and maintainability. 

The intelligent feedback loop between the browser automation and LLM components allows the system to adapt to virtually any website interface without predefined test scripts. This makes it possible to test complex user journeys using natural language instructions that non-technical stakeholders can easily define.

The addition of the PDF export feature enhances the utility of the system by providing comprehensive, shareable test reports that detail the testing process and results, making it easier for teams to document and communicate test outcomes.
