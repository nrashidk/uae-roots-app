# UAE Roots Family Tree Application

## Overview
This is a React-based family tree application designed for UAE heritage documentation. The application provides a comprehensive interface for creating and managing family genealogy with Arabic language support.

## Project Architecture
- **Frontend Framework**: React 19.1.0 with Vite 6.3.6 build tool
- **UI Framework**: Radix UI components with Tailwind CSS for styling
- **Language**: TypeScript/JavaScript with Arabic RTL (Right-to-Left) support
- **Font Support**: Sakkal Majalla and Arabic fonts for proper Arabic text rendering
- **State Management**: React hooks (useState, useEffect, useRef)
- **Routing**: React Router DOM 7.6.1

## Key Features
- Arabic language interface with RTL support
- Authentication system (Google, Apple, UAE Mobile)
- Interactive family tree builder with drag and pan functionality
- Advanced layout algorithms for family tree visualization
- Export functionality (HTML, GEDCOM, CSV, Plain Text)
- Responsive design with zoom and pan controls
- Family member management with detailed personal information

## Project Structure
```
src/
├── components/
│   └── ui/          # Reusable UI components (Button, Card, Dialog, etc.)
├── lib/
│   └── utils.js     # Utility functions
├── App.jsx          # Main application component
├── main.jsx         # Application entry point
├── App.css          # Main styles
└── index.css        # Global styles
```

## Development Setup (Completed)
✅ Configured Vite for Replit environment (host 0.0.0.0:5000)
✅ Installed all dependencies via npm
✅ Set up development workflow on port 5000
✅ Fixed HMR (Hot Module Reload) WebSocket connection
✅ Resolved code structure issues in App.jsx
✅ Verified application renders correctly

## Deployment Configuration (Completed)
✅ Configured for autoscale deployment
✅ Build command: `npm run build`
✅ Run command: `npm run preview`

## Recent Changes
- **2025-10-01**: Restored App.jsx and App.css to original GitHub version (commit a7df18d) - reverted unsuccessful rendering fixes
- **2025-09-28**: Fixed auto-layout logic placement in App.jsx that was causing render issues
- **2025-09-28**: Configured Vite server settings for Replit compatibility
- **2025-09-28**: Set up development workflow and deployment configuration

## Technical Notes
- The application uses modern React patterns with hooks
- Supports complex family relationship modeling (partners, children, parents, siblings)
- Implements smart positioning algorithms for family tree layout
- Arabic text is properly configured with RTL support
- All UI components are from Radix UI for accessibility compliance

## Current Status
The application is fully functional and ready for development and deployment. The authentication screen loads correctly with Arabic text and all three login options are visible.