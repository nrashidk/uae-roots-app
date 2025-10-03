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
- **2025-10-03**: Family member organization by husband's lineage:
  - Reorganized Family Members display to show families by husband's lineage first
  - Display order: husband's ancestors → husband → descendants → wife's ancestors → wife
  - Example order: عبيد (grandfather) → راشد (father) → ناصر (husband) → محمد (son) → هند (wife)
  - Children appear under husband's paternal lineage per Islamic tradition
  - Processes all partnerships to organize families by male lineage
  - Duplicate prevention ensures each person appears only once
- **2025-10-03**: Genealogical chain display and parent re-linking:
  - Implemented dynamic genealogical name chains in Family Members view
  - Names trace up through paternal lineage: "محمد ناصر راشد عبيد آل علي"
  - Family name (lastName) inherited from oldest ancestor
  - All family members displayed (not just one lineage path)
  - Names automatically update when ancestors are added later
  - Renamed reorder arrow buttons from "الأكبر/الأصغر" to "أكبر/أصغر" (removed definite article)
  - Added "Manage Parents" feature allowing children to be linked to spouses added after child creation
  - New context-aware button appears only when child has parent with unlinked spouse
  - Dialog shows current parents and available spouses to link
  - Comprehensive validation: max 2 parents, ensures parents are actually partners
  - Automatic birth order recalculation when child's parent set changes
  - Birth order assigns child to new parent set's sibling sequence
- **2025-10-01**: Tree deletion and action button improvements:
  - Fixed: Tree automatically deleted when last member is removed (dashboard now shows 0 trees)
  - Centered action buttons below person boxes using dynamic width calculation
  - Added marriage restrictions following Islamic customs:
    - Females with male spouses cannot add additional spouses
    - Living males can only have up to 4 living spouses
  - Button container automatically adjusts width based on visible buttons (4 or 5)
  - Auto-set spouse gender: male→female spouse, female→male spouse (follows religious custom)
  - Fixed addPerson() to respect form-provided gender values
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

## Pending Implementation (When Website is 100% Complete)

### 1. Database Integration 🗄️
**Status:** Infrastructure ready, integration deferred

**What's Prepared:**
- ✅ PostgreSQL database provisioned (10 GB limit)
- ✅ Drizzle ORM installed and configured
- ✅ Database schema designed (trees, people, relationships tables)
- ✅ Tables created successfully in database
- ✅ Database scripts added (db:push, db:studio)

**What's Needed:**
- ❌ Express backend server setup
- ❌ API routes for CRUD operations
- ❌ Frontend migration from in-memory state to API calls
- ❌ Data persistence layer

**Estimated Time:** 2-3 hours
**Strategy:** Add Express backend and migrate all data to PostgreSQL in single deployment

---

### 2. Real Authentication System 🔐
**Status:** Integrations identified, implementation deferred

**Authentication Requirements:**
1. **Google Login** - via Replit Auth integration
2. **Apple ID Login** - via Replit Auth integration  
3. **UAE Mobile SMS Verification** - via Twilio connector

**What's Prepared:**
- ✅ Replit Auth integration identified (supports Google, Apple, GitHub, X, email/password)
- ✅ Twilio connector identified (SMS verification)
- ✅ Session management strategy planned
- ✅ User schema designed in database

**What's Needed:**
- ❌ Express backend with session management
- ❌ Replit Auth integration setup
- ❌ Twilio SMS verification flow
- ❌ Frontend authentication UI (login redirects, logout, protected routes)
- ❌ User profile management

**Estimated Time:** 4-6 hours
**Strategy:** Implement all three authentication methods simultaneously when backend is ready

---

**Current Development Strategy:**
- ✅ Continue using in-memory state (React useState)
- ✅ Continue using mock/test authentication buttons
- ✅ Focus on perfecting family tree features and UI
- ✅ No backend complexity during development
- ✅ No costs until deployment

**Launch Checklist:** When website features are 100% complete, implement in this order:
1. Set up Express backend server
2. Implement database integration
3. Add authentication system (Google + Apple + SMS)
4. Deploy to production