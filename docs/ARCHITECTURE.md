# Landing Page Lead Funnel Validation Tool - Architecture

## 1. System Overview

The Landing Page Lead Funnel Validation Tool automatically tests and validates "Book a Demo" flows on company landing pages using AI-powered testing. The system consists of three main components:

1. **Next.js Frontend**: User interface for entering URLs and viewing test results
2. **Next.js API Routes**: Handles requests and orchestrates testing
3. **Playwright Testing Service**: Executes browser automation with LLM guidance

## 2. High-Level Architecture

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
│                 │         │                    │         │                     │
└─────────────────┘         └────────────────────┘         └─────────────────────┘
```

## 3. Frontend Architecture

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
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Key components:
- **URL Input Form**: Collects the landing page URL and optional custom test steps
- **Test Results Display**: Shows status, steps, screenshots, and errors
- **API Service**: Handles communication with backend
- **Screenshots Component**: Displays test progression visually 
- **Custom Test Steps**: Allows defining natural language test instructions

## 4. Backend Architecture

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

## 5. Test Execution Flow

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

## 6. LLM Integration and DOM Interaction

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

## 7. API Specifications

### POST /api/test-booking-flow

**Request Body**:
```json
{
  "url": "https://example.com",
  "customSteps": [
    "Click on the Contact Us button",
    "Fill in the form with test data",
    "Submit the form"
  ]
}
```

**Response Body**:
```json
{
  "success": true,
  "testId": "test-123",
  "demoFlowFound": true,
  "bookingSuccessful": true,
  "steps": [
    {
      "name": "Landing Page Load",
      "status": "success",
      "duration": 1240,
      "screenshot": "base64-encoded-image"
    },
    // Additional steps...
  ],
  "totalDuration": 6390,
  "errors": []
}
```

## 8. Deployment Architecture

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

## 9. Security & Monitoring

- **Input Validation**: URL validation to prevent injection attacks
- **Rate Limiting**: Protection against abuse
- **Error Handling**: Graceful degradation and detailed logging
- **Monitoring**: Performance metrics and error tracking

## 10. DOM Interaction Layer Details

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

## 11. Conclusion

This architecture provides a scalable, reliable system for validating booking flows using AI-powered testing. The separation of concerns between the Next.js frontend/API, the DOM Interaction Layer, and the LLM decision engine enables efficient resource utilization and a high degree of flexibility and maintainability.
