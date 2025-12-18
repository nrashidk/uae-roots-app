# UAE Roots Family Tree Application

## Overview
This React-based family tree application is designed for documenting UAE heritage. It provides a comprehensive, Arabic-language interface for creating, managing, and visualizing family genealogies, with a focus on cultural accuracy and ease of use. The project aims to digitally preserve and present family histories within a culturally relevant framework.

## User Preferences
I prefer simple language and detailed explanations. I want iterative development and for you to ask before making major changes. Do not make changes to the folder `Z` and do not make changes to the file `Y`.

## Recent Changes (December 2024)
- **Security Enhancements**:
  - HttpOnly cookie-based JWT authentication (replaces localStorage)
  - Comprehensive audit logging for sensitive operations
  - PII encryption at rest using AES-256-GCM with IV and auth tag (upgraded from CryptoJS)
  - CORS restrictions for development/production environments
  - Multi-provider account linking with verified identities only (prevents account takeover)
  - SQL search pattern escaping to prevent LIKE injection
  - JWT expiry reduced to 7 days (from 30 days) for improved security
- **New Features**:
  - Family member search functionality
  - Photo upload for family members
  - Edit history with undo/redo capability
  - Multi-format data export (GEDCOM, CSV, HTML, Text, JSON)
  - Privacy policy page
  - Multi-provider authentication: Users can login with multiple methods (phone, email, Google, Microsoft) linked to same account
- **Technical Improvements**:
  - TypeScript configuration added
  - Loading state components (spinners, skeletons)
  - Type definitions for all data models
  - URL encoding fix for phone numbers with + characters in API requests
  - Auth identities table for multi-provider account resolution

## System Architecture
The application utilizes React 19.1.0 with Vite 6.3.6 for the frontend, styled with Radix UI components and Tailwind CSS. It supports Arabic (RTL) with specific fonts (Sakkal Majalla) for proper rendering. State management is handled with React hooks, and routing with React Router DOM 7.6.1.

Key features include:
- **UI/UX**: Arabic language interface with RTL support, responsive design, interactive family tree visualization with zoom, pan, and drag functionalities. Enhanced selection indicators provide clear visual feedback. Color coding distinguishes genders (light blue for males, light pink for females).
- **Technical Implementations**: Advanced layout algorithms for family tree visualization, professional hierarchy chart visualization with T-shape connections, and couple-based grouping for multi-partner support.
- **Feature Specifications**:
    - **Authentication**: Integrated Google, Microsoft, Email/Password (Firebase), and UAE Mobile SMS verification (Twilio). JWT tokens stored in secure HttpOnly cookies.
    - **Data Management**: Full CRUD operations for trees, people, and relationships, with data persistence via PostgreSQL and Drizzle ORM.
    - **Family Relationship Modeling**: Supports complex relationships including breastfeeding siblings, with specific UI indicators and counting. Genealogical name chains trace paternal lineage.
    - **Export Functionality**: Supports exporting family data in HTML, GEDCOM, CSV, JSON, and Plain Text formats.
    - **Search**: Real-time search for family members within trees.
    - **Photo Upload**: Upload and manage photos for family members (stored in /uploads directory).
    - **Undo/Redo**: Edit history tracking with ability to undo changes.
    - **Islamic Custom Adherence**: Implements marriage restrictions (e.g., maximum four living spouses for males), automatic spouse gender setting, and organization of family members by husband's lineage.
    - **Dynamic UI**: Action buttons beneath person boxes dynamically adjust width. Zoom and pan controls are fixed on screen.
    - **Layouts**: Family members are displayed in a responsive two-column grid. Dashboard shows relationship summaries, with a detailed view for male parents.
    - **Security**: 
      - HttpOnly cookie-based JWT authentication
      - Firebase token verification
      - Ownership validation for all resources
      - Rate limiting (50 req/min API, 5 req/15min SMS)
      - Zod input validation on all endpoints
      - Helmet security headers with CSP
      - CORS configuration (localhost in dev, allowed domains in prod)
      - Audit logging for sensitive operations with request ID correlation
      - PII encryption at rest using AES-256-GCM (with IV and authentication tag)
      - Dual-format decryption for backward compatibility with legacy encrypted data
      - SQL LIKE pattern escaping to prevent wildcard injection
      - JWT secret strength validation (32+ chars required in production)
      - JWT token expiry: 7 days (aligned with cookie maxAge)
      - ENCRYPTION_KEY validation with secure warnings
      - Authenticated photo access endpoint (/api/photos/:filename)
      - Undo operation data validation to prevent tampering
      - XSS sanitization for user-generated text (names, descriptions)
      - Magic byte verification for uploaded files (JPEG, PNG, GIF, WebP)
      - Request ID tracking (X-Request-ID header) for log correlation
      - Automatic audit log cleanup (90-day retention policy)

## Database Schema
- **users**: User accounts with authentication info
- **trees**: Family trees with ownership
- **people**: Family members with personal data (PII encrypted)
- **relationships**: Connections between people (partner, parent-child, sibling)
- **audit_logs**: Security audit trail
- **edit_history**: Undo/redo capability

## External Dependencies
- **Database**: PostgreSQL (via Neon Serverless PostgreSQL)
- **ORM**: Drizzle ORM
- **Authentication**:
    - Firebase Authentication (for Google, Microsoft, Email/Password login)
    - Twilio (for UAE Mobile SMS verification)
- **Backend**: Express.js
- **Libraries/Frameworks**:
    - React 19.1.0
    - Vite 6.3.6
    - Radix UI
    - Tailwind CSS
    - React Router DOM 7.6.1
    - Zod (for validation)
    - Helmet (for security headers)
    - Multer (for file uploads)
    - CryptoJS (for PII encryption)
    - cookie-parser (for HttpOnly cookies)

## Key Files
- `server/index.js` - Express backend with all API endpoints
- `src/lib/api.js` - Frontend API client
- `shared/schema.js` - Drizzle database schema
- `src/components/` - React components
- `src/pages/PrivacyPolicy.jsx` - Privacy policy page
- `src/types/index.ts` - TypeScript type definitions
