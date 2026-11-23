# Team Task Division & Contribution Breakdown

## Project Overview
- **Project Title:** FindIt – University Lost & Found Portal
- **Institution:** MAWTS Institute of Technology (Configurable)
- **Academic Supervisor:** Joy Debnath
- **Team Identification:** Group 3

---

## Team Roster & Module Ownership

### 1. MD Ibrahim Khalil (Team Leader & Security Engineer)
- **Primary Responsibilities:** Project Architecture, Integration, Supabase Database Security, Cryptographic Hashing & Final Code Review.
- **Key Deliverables:**
  - Designed the comprehensive PostgreSQL migration schema in `supabase/schema.sql`.
  - Architected the safe database views (`public_items` and `public_leaderboard`) preventing exposure of sensitive columns.
  - Implemented the `SECURITY DEFINER` RPC function `verify_and_get_contact` with anti-brute force throttling and pgcrypto Bcrypt matching.
  - Implemented the `post_item` RPC to ensure secret verification answers are hashed server-side and never stored in plain text.
  - Formulated Row Level Security (RLS) policies and storage bucket access rules for `item-images`.
  - Authored the Open Source Audit & Attribution report in `LICENSE-ATTRIBUTION.md`.
  - Final integration, quality assurance review, and security audit.

### 2. Adib Akanda (UI/UX Designer & Frontend Engineer)
- **Primary Responsibilities:** Design System, CSS Architecture, Responsive Layouts, Theme Engine & Visual Assets.
- **Key Deliverables:**
  - Authored master stylesheet `style.css` following university SaaS dashboard aesthetic.
  - Designed custom CSS custom property tokens for Light and Dark themes.
  - Created the brand identity, typography scale, elevation shadows, and rounded cards.
  - Authored the custom vector brand logo `assets/logo.svg` and placeholder fallback `assets/images/placeholder.svg`.
  - Designed responsive mobile navigation with drawer menu and theme switcher in `js/common.js`.
  - Implemented the visual resolution status timeline component (Lost/Found → Claimed → Returned).

### 3. Konika Tripura (Authentication & Forms Developer)
- **Primary Responsibilities:** Supabase Auth Integration, Form Validations, Route Protection & Post Submission Flow.
- **Key Deliverables:**
  - Implemented `js/auth.js` for student signup and login workflows with password visibility toggles.
  - Engineered client-side validation logic for emails, passwords, and student phone numbers.
  - Built protected page routing guards (`requireAuth` and `redirectIfAuth`) with query parameter redirect preservation.
  - Built `post.html` and `js/post.js` supporting Lost vs Found item submission.
  - Developed image validation for MIME types and strict 2 MB maximum file size with live client-side preview.
  - Integrated dynamic display of the Secret Ownership Challenge fields for found items.

### 4. Christopher Mack Dcosta (Search, Filters & Listing Details Developer)
- **Primary Responsibilities:** Catalog Exploration, Multi-Parameter Search, Card Components & Details View.
- **Key Deliverables:**
  - Implemented `js/home.js` powering the homepage hero search and latest active reports.
  - Built `items.html` and `js/items.js` with comprehensive multi-criteria filtering: keyword search, type tabs (All/Lost/Found), categories (Bag, Phone, ID Card, Books, Keys, Other), date, and campus location.
  - Implemented sorting (Newest/Oldest) and "Load More" pagination.
  - Developed `item.html` and `js/item.js` rendering complete item details, location, incident dates, and shareable links.
  - Integrated the verification challenge form and safe DOM renderer strictly avoiding `innerHTML` for untrusted user input.

### 5. Akash Biswas (Dashboard, Gamification & QA Testing Developer)
- **Primary Responsibilities:** Student Dashboard, Claims Management, Gamification System & End-to-End Testing.
- **Key Deliverables:**
  - Developed `dashboard.html` and `js/dashboard.js` displaying student profile stats, earned points, and badge tiers.
  - Engineered the item status update modal and verified the exactly-once 50-point award trigger upon transitioning found items to "Returned".
  - Implemented report edit and delete modals with RLS-compliant owner checks.
  - Built the claims history tracker showing all verified ownership recoveries.
  - Built `leaderboard.html` and `js/leaderboard.js` featuring top 3 visual podiums and ranked honor roll.
  - Co-authored demo dataset in `supabase/seed.sql` and executed the Quality Assurance test matrix.

---

## Collaboration Matrix & Verification Sign-Off

| Member | Module Assigned | Status | Verification Sign-Off |
| :--- | :--- | :--- | :--- |
| **MD Ibrahim Khalil** | Architecture, Database Security, RPCs, Schema | Completed | Verified (Lead Sign-Off) |
| **Adib Akanda** | Design System, CSS, Theme, Logo SVG | Completed | Verified |
| **Konika Tripura** | Auth, Protected Routes, Post Item Form | Completed | Verified |
| **Christopher Mack Dcosta** | Search Engine, Filter Toolbar, Item Details | Completed | Verified |
| **Akash Biswas** | Dashboard, Status Workflow, Leaderboard, QA | Completed | Verified |
