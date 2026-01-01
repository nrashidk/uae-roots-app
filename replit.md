# UAE Roots Family Tree Application

## Overview
This React-based family tree application is designed for documenting UAE heritage. It provides a comprehensive, Arabic-language interface for creating, managing, and visualizing family genealogies, with a focus on cultural accuracy and ease of use. The project aims to digitally preserve and present family histories within a culturally relevant framework.

## User Preferences
I prefer simple language and detailed explanations. I want iterative development and for you to ask before making major changes. Do not make changes to the folder `Z` and do not make changes to the file `Y`.

## Recent Changes (January 2026)
- **Security Hardening (Option 1 Implementation)**:
  - JWT_SECRET moved from config file to secure Replit Secrets (no longer visible in code)
  - Database connection URL redacted in logs (credentials hidden as `***:***`)
  - JWT token expiration reduced from 7 days to 24 hours (improved session security)
  - All existing sessions invalidated (users need to log in again with new secure tokens)
- **Dashboard Count Consistency Fix**:
  - Dashboard "Family Members" count now matches the tree visualization count
  - Uses the tree layout data (connected members only) instead of raw database count
  - Ensures consistency between what's shown in the tree and the dashboard statistics
- **Reverted Disconnected Family Groups Feature**:
  - Removed the feature that displayed disconnected family groups to the right of the main tree
  - Tree visualization now only shows members connected to the root person (simpler, cleaner display)

## Recent Changes (December 2024)
- **Security Enhancements**:
  - HttpOnly cookie-based JWT authentication (replaces localStorage)
  - Comprehensive audit logging for sensitive operations
  - PII encryption at rest using AES-256-GCM with IV and auth tag (upgraded from CryptoJS)
  - CORS restrictions for development/production environments
  - Multi-provider account linking with verified identities only (prevents account takeover)
  - SQL search pattern escaping to prevent LIKE injection
  - JWT expiry: 24 hours (reduced from 7 days in January 2026 security hardening)
  - Cookie settings updated for Replit preview iframe (sameSite:'none', secure:true, trust proxy)
- **New Features**:
  - Family member search functionality
  - Photo upload for family members
  - Edit history with undo/redo capability
  - Multi-format data export (GEDCOM, CSV, HTML, Text, JSON)
  - Privacy policy page
  - Multi-provider authentication: Users can login with multiple methods (phone, email, Google, Microsoft) linked to same account
  - **Session Restoration**: Automatic loading of user's family trees when Firebase restores authentication session
- **Technical Improvements**:
  - TypeScript configuration added
  - Loading state components (spinners, skeletons)
  - Type definitions for all data models
  - URL encoding fix for phone numbers with + characters in API requests
  - Auth identities table for multi-provider account resolution
  - Session restoration with fallback handling: checks backend cookie validity, refreshes Firebase tokens, caches resolved userId in sessionStorage (not JWT for security)
  - Race condition prevention: interactiveLoginInProgressRef prevents session restore from conflicting with interactive logins
  - Debug endpoint /api/debug/session for diagnosing authentication state
  - Consolidated loadUserTreeData helper function for consistent tree loading across all auth flows
  - Cookie-based session restoration for Phone SMS users (who don't have Firebase sessions)
  - Dual restoration path: Firebase-based for Google/Microsoft/Email, Cookie-based for Phone SMS
  - Unified phone number normalization across server and client (handles 00971, 971, 0, +971 formats)
  - Logout now properly clears backend JWT cookie (prevents stale session issues)
  - "No Trees Found" warning screen for authenticated users (prevents silent tree creation and guides users to try different login methods if needed)

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
      - Authenticated photo access endpoint (/api/photos/:filename) - no public static serving
      - Photo URL normalization for legacy database records
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
