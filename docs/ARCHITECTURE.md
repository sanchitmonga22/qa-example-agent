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
│  UI Components  │         │ Request Processing │         │ Browser Automation  │
│  • URL Input    │         │ • Validation       │         │ • Page Navigation   │
│  • Test Results │         │ • Error Handling   │         │ • Element Detection │
│  • Screenshots  │         │ • Test Orchestration│        │ • Form Filling      │
│                 │         │                    │         │ • LLM Guidance      │
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
│  │  Browser       │────────────┘                    │             │
│  │  Automation    │─────────────────────────────────┘             │
│  │                │                                               │
│  └────────────────┘                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Key components:
- **API Routes**: Handle requests and proxy to testing service
- **Test Orchestration**: Controls the testing process flow
- **Browser Automation**: Executes Playwright tests
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

## 6. LLM Integration

```
┌──────────────────────┐          ┌───────────────────────┐
│                      │          │                       │
│  Browser Automation  │◄────────►│  LLM Decision Engine  │
│  (Playwright)        │          │  (OpenAI API)         │
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

The LLM integration enables intelligent navigation through:
1. Extracting page state (DOM elements, screenshots)
2. Sending this information to the LLM with appropriate context
3. Receiving action recommendations (which elements to click, what data to enter)
4. Executing those actions and capturing results

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

## 10. Conclusion

This architecture provides a scalable, reliable system for validating booking flows using AI-powered testing. The separation of concerns between the Next.js frontend/API and the Playwright testing service enables efficient resource utilization while maintaining a seamless user experience.
