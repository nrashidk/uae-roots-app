# UAE Roots Family Tree Application

## Overview
This React-based family tree application is designed for documenting UAE heritage. It provides a comprehensive, Arabic-language interface for creating, managing, and visualizing family genealogies, with a focus on cultural accuracy and ease of use. The project aims to digitally preserve and present family histories within a culturally relevant framework.

## User Preferences
I prefer simple language and detailed explanations. I want iterative development and for you to ask before making major changes. Do not make changes to the folder `Z` and do not make changes to the file `Y`.

## System Architecture
The application utilizes React 19.1.0 with Vite 6.3.6 for the frontend, styled with Radix UI components and Tailwind CSS. It supports Arabic (RTL) with specific fonts (Sakkal Majalla) for proper rendering. State management is handled with React hooks, and routing with React Router DOM 7.6.1.

Key features include:
- **UI/UX**: Arabic language interface with RTL support, responsive design, interactive family tree visualization with zoom, pan, and drag functionalities. Enhanced selection indicators provide clear visual feedback. Color coding distinguishes genders (light blue for males, light pink for females).
- **Technical Implementations**: Advanced layout algorithms for family tree visualization, professional hierarchy chart visualization with T-shape connections, and couple-based grouping for multi-partner support.
- **Feature Specifications**:
    - **Authentication**: Integrated Google, Microsoft, Email/Password (Firebase), and UAE Mobile SMS verification (Twilio).
    - **Data Management**: Full CRUD operations for trees, people, and relationships, with data persistence via PostgreSQL and Drizzle ORM.
    - **Family Relationship Modeling**: Supports complex relationships including breastfeeding siblings, with specific UI indicators and counting. Genealogical name chains trace paternal lineage.
    - **Export Functionality**: Supports exporting family data in HTML, GEDCOM, CSV, and Plain Text formats.
    - **Islamic Custom Adherence**: Implements marriage restrictions (e.g., maximum four living spouses for males), automatic spouse gender setting, and organization of family members by husband's lineage.
    - **Dynamic UI**: Action buttons beneath person boxes dynamically adjust width. Zoom and pan controls are fixed on screen.
    - **Layouts**: Family members are displayed in a responsive two-column grid. Dashboard shows relationship summaries, with a detailed view for male parents.
    - **Security**: Implemented JWT authentication, Firebase token verification, ownership validation, rate limiting, Zod input validation, Helmet security headers, and CORS configuration.

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