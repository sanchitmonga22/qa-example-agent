# Landing Page Lead Funnel Validation Tool

A web application designed to automatically test and validate the "Book a Demo" flow on company landing pages. This tool helps marketing and sales teams ensure their lead generation funnels are working correctly.

## Features

- Automatically detect "Book a Demo" elements on landing pages
- Simulate user interactions to complete the booking flow
- Capture screenshots of key steps in the process
- Identify and report any errors or issues
- View test history and results

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, TailwindCSS, ShadcnUI
- **Backend**: Next.js API Routes
- **Testing**: Playwright for browser automation
- **Deployment**: Vercel (frontend) and Railway.app (Playwright service)

## Development Setup

### Prerequisites

- Node.js (v18 or newer)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/booking-agent.git
cd booking-agent
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

- `/src` - Source code
  - `/app` - Next.js app router pages
  - `/components` - React components
  - `/lib` - Utility functions and shared code
- `/public` - Static assets
- `/docs` - Project documentation

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

MIT
