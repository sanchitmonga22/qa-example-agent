# Landing Page Lead Funnel Validation Tool - Architecture

## 1. System Overview

The Landing Page Lead Funnel Validation Tool is a web application designed to automatically test and validate the "Book a Demo" flow on company landing pages. The system consists of:

- A **Next.js frontend** that provides a user interface for entering URLs and viewing test results
- **Next.js API routes** that handle requests and orchestrate the testing process
- **Playwright** integration for automating browser interactions and simulating user behavior

## 2. Architecture Diagram

```
┌───────────────────┐      ┌───────────────────────────┐      ┌─────────────────────┐
│                   │      │                           │      │                     │
│  Next.js Frontend │──────▶  Next.js API Routes       │──────▶  Playwright Engine  │
│                   │      │                           │      │                     │
└───────────────────┘      └───────────────────────────┘      └─────────────────────┘
         │                              │                               │
         │                              │                               │
         ▼                              ▼                               ▼
┌───────────────────┐      ┌───────────────────────────┐      ┌─────────────────────┐
│                   │      │                           │      │                     │
│   User Interface  │      │   Test Processing Logic   │      │  Browser Automation │
│                   │      │                           │      │                     │
└───────────────────┘      └───────────────────────────┘      └─────────────────────┘
```

## 3. Frontend Architecture

### Pages

- **Home Page (`/`)**: Contains the URL input form and test results dashboard
- **History Page (`/history`)**: Optional page to view past test results

### Components

- **UrlInputForm**: Handles URL submission with validation
- **TestResults**: Displays test execution results with status indicators
- **StatusIndicator**: Visual representation of test status (running, success, failure)
- **ErrorDisplay**: Shows detailed error information if tests fail
- **Screenshots**: Displays captured screenshots from key steps in the testing process

### State Management

- React's useState and useContext for local and global state management
- Key states tracked:
  - URL input value
  - Test execution status
  - Test results
  - Error messages

## 4. Backend Architecture

### API Routes

- **/api/test-booking-flow**: Primary endpoint that processes test requests
  - Accepts POST requests with landing page URL
  - Validates input
  - Initiates Playwright testing process
  - Returns structured test results

- **/api/test-status/:id**: Optional endpoint to check status of long-running tests
  - Retrieves status of in-progress tests
  - Supports polling for asynchronous test execution

### Playwright Integration

- **BookingFlowTest** class: Core testing logic implemented as a class with methods for:
  - Navigating to the landing page
  - Finding and interacting with "Book a Demo" elements
  - Filling out booking forms
  - Verifying successful submission
  - Capturing screenshots at key points
  - Error handling and reporting

- **TestDataGenerator**: Generates test data for form submission (names, emails, etc.)

## 5. Data Flow

1. **User Initiates Test**:
   - User enters landing page URL in the frontend
   - Frontend validates URL format
   - Frontend sends POST request to `/api/test-booking-flow` with URL

2. **Test Execution**:
   - API route receives request and validates input
   - Playwright instance is created
   - Testing script navigates through the booking flow
   - Screenshots and timing data are captured

3. **Results Processing**:
   - Test results are structured into a standardized format
   - Results include success/failure status, screenshots, timing data, and errors
   - API returns complete results to frontend

4. **Results Display**:
   - Frontend receives and processes test results
   - UI updates to show test status and findings
   - Screenshots and detailed steps are displayed
   - Error information is presented if applicable

## 6. API Specifications

### POST /api/test-booking-flow

**Request Body**:
```json
{
  "url": "https://example.com",
  "options": {
    "timeout": 30000,
    "screenshotCapture": true
  }
}
```

**Response Body** (Success):
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
      "screenshot": "base64-encoded-image-data"
    },
    {
      "name": "Demo Button Detection",
      "status": "success",
      "duration": 350,
      "screenshot": "base64-encoded-image-data"
    },
    {
      "name": "Form Fill",
      "status": "success",
      "duration": 2100,
      "screenshot": "base64-encoded-image-data"
    },
    {
      "name": "Form Submission",
      "status": "success",
      "duration": 1800,
      "screenshot": "base64-encoded-image-data"
    },
    {
      "name": "Confirmation Detection",
      "status": "success",
      "duration": 900,
      "screenshot": "base64-encoded-image-data"
    }
  ],
  "totalDuration": 6390,
  "errors": []
}
```

**Response Body** (Failure):
```json
{
  "success": false,
  "testId": "test-124",
  "demoFlowFound": true,
  "bookingSuccessful": false,
  "steps": [
    {
      "name": "Landing Page Load",
      "status": "success",
      "duration": 1350,
      "screenshot": "base64-encoded-image-data"
    },
    {
      "name": "Demo Button Detection",
      "status": "success",
      "duration": 420,
      "screenshot": "base64-encoded-image-data"
    },
    {
      "name": "Form Fill",
      "status": "success",
      "duration": 2300,
      "screenshot": "base64-encoded-image-data"
    },
    {
      "name": "Form Submission",
      "status": "failure",
      "duration": 1200,
      "screenshot": "base64-encoded-image-data",
      "error": "Form submission failed - validation error detected"
    }
  ],
  "totalDuration": 5270,
  "errors": [
    {
      "step": "Form Submission",
      "message": "Form submission failed - validation error detected",
      "details": "Error message displayed on form: 'Invalid email format'"
    }
  ]
}
```

## 7. Deployment Architecture

### Hosting Solution

The simplest and most reliable hosting approach is a **hybrid deployment model**:

1. **Next.js Frontend & API Routes**: Deployed on Vercel
   - The Next.js application (UI and API routes) will be hosted on Vercel's platform
   - Vercel provides excellent integration with Next.js applications
   - Global CDN for fast delivery of static assets
   - Simple GitHub integration for CI/CD

2. **Playwright Testing Service**: Deployed on a dedicated service
   - For reliable Playwright execution, we'll use **Railway.app**
   - Railway provides:
     - Docker-based deployment (perfect for Playwright)
     - Generous resource limits (4GB RAM, 2 CPUs in starter plan)
     - Longer execution timeouts than serverless functions
     - Simple GitHub integration for deployment
     - Reasonable pricing model

3. **Connection Between Services**:
   - Next.js API routes will function as proxies
   - When a test is requested:
     1. The Next.js API receives the initial request
     2. It forwards the request to the Railway-hosted Playwright service
     3. The Playwright service executes the test and returns results
     4. Next.js API returns these results to the frontend

This hybrid approach solves several problems:

- **Resource Limitations**: Overcomes the memory and CPU constraints of serverless functions
- **Execution Time**: Avoids timeout issues common with serverless functions
- **Scalability**: Both services can scale independently based on load
- **Simplicity**: Both services have simple deployment processes

### Alternative Approaches

If Railway is not preferred, these alternatives could be considered:

1. **Render.com**: Similar to Railway with good Docker support
2. **AWS App Runner**: Container-based service with automatic scaling
3. **Google Cloud Run**: Serverless containers with flexible execution times
4. **Digital Ocean App Platform**: Easy deployment with predictable pricing

## 8. Scalability Considerations

- **Concurrent Test Execution**: Handle multiple simultaneous test requests using:
  - Request queuing with rate limiting
  - Worker pool for Playwright instances
  - Asynchronous execution with status polling

- **Performance Optimization**:
  - Lightweight Playwright browser instances
  - Efficient screenshot compression
  - Caching of test results for recently tested URLs

- **Resource Management**:
  - Timeouts for long-running tests
  - Browser instance cleanup after tests complete
  - Memory limits for serverless function execution

- **Hosting-Specific Scaling**:
  - Railway.app containers can be configured to auto-scale based on demand
  - Implement a queue system for high-traffic scenarios
  - Consider adding Redis for distributed job processing in high-volume situations

## 9. Security Considerations

- **Input Validation**: Strict validation of URL inputs to prevent injection attacks
- **Rate Limiting**: Prevent abuse through API rate limiting
- **Data Protection**: No permanent storage of sensitive test data
- **Isolated Execution**: Each test runs in an isolated browser context
- **Safe Output Handling**: Sanitization of test results and error messages
- **Inter-Service Communication**: Secure API keys for communication between Vercel and Railway services
- **Environmental Variables**: Store all sensitive configuration in environment variables

## 10. Error Handling & Monitoring

- **Graceful Degradation**: System continues functioning even if some components fail
- **Comprehensive Logging**: Detailed logs for troubleshooting with various log levels
- **Error Classification**:
  - Connection errors (network issues)
  - Detection errors (elements not found)
  - Interaction errors (can't click or fill forms)
  - Validation errors (form validation issues)
  - System errors (internal failures)

- **Monitoring Integration**:
  - Performance metrics collection
  - Error rate tracking
  - Test success/failure rates
  - Integration with external monitoring tools

- **Hosting-Specific Monitoring**:
  - Vercel Analytics for frontend performance
  - Railway metrics for backend resource usage
  - Set up alerts for resource constraints or failures

## 11. Hosting Cost Estimation

**Vercel (Frontend & API Routes)**
- Hobby Plan: Free
- Pro Plan: $20/month (recommended for production)
  - Includes team collaboration
  - Unlimited function execution
  - Better performance

**Railway.app (Playwright Service)**
- Developer Plan: $5/month + usage
  - $10-20/month for typical usage
  - Includes sufficient resources for Playwright execution

**Total Monthly Cost (Production)**
- Approximately $30-40/month for a production deployment
- Cost can scale with usage

## 12. Implementation Timeline for Hosting

1. **Week 1**: Set up development environments
   - Initialize Next.js project
   - Set up local Playwright tests
   - Create GitHub repository

2. **Week 2**: Implement core functionality
   - Develop frontend UI
   - Create API routes
   - Implement Playwright test scripts

3. **Week 3**: Set up deployment pipeline
   - Configure Vercel deployment for Next.js
   - Set up Railway project for Playwright service
   - Implement communication between services

4. **Week 4**: Testing and optimization
   - End-to-end testing
   - Performance optimization
   - Final deployment

## 13. Future Extensions

- **Custom Test Scenarios**: Allow users to define custom booking flow patterns
- **API Integration**: Enable integration with other tools via API
- **Historical Analytics**: Track and analyze test results over time
- **Multi-browser Testing**: Test booking flows across different browsers
- **Advanced Reporting**: Generate detailed PDF reports for stakeholders
- **Self-Hosted Option**: Create Docker Compose setup for fully self-hosted deployment
