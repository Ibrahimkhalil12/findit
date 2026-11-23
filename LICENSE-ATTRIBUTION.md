# Open Source Repository Audit & License Attribution

## Project Overview
- **Project Name:** FindIt – University Lost & Found Portal
- **Institution:** MAWTS Institute of Technology (Configurable)
- **Team:** Group 3 (MD Ibrahim Khalil, Adib Akanda, Konika Tripura, Christopher Mack Dcosta, Akash Biswas)
- **Supervisor:** Joy Debnath

---

## Phase 1: Repository Audit & Evaluation

In accordance with Phase 1 instructions, a thorough legal and technical inspection of candidate Lost & Found repositories was performed prior to development.

### Candidate 1: `zeegma/bark` (PUP-BARK)
- **URL:** [https://github.com/zeegma/bark](https://github.com/zeegma/bark)
- **Description:** Lost and found web application developed for the Polytechnic University of the Philippines (PUP Manila).
- **Tech Stack:** Svelte, Vite, Python / Django, Supabase.
- **License Inspection:** Distributed under the **Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)** license.
- **Legal Verdict:** **REJECTED.** The CC BY-ND 4.0 license strictly prohibits creating derivative works, modifying the source code, or redistributing adapted versions. Per project guidelines (*"Reject NoDerivatives licenses and repositories with unclear reuse permissions"*), this repository cannot be modified or repurposed legally.
- **Technical Verdict:** Incompatible with the required strict frontend stack (HTML5, CSS3, Vanilla ES6+ without frameworks like Svelte/Vite, and serverless Supabase without Django).

### Candidate 2: `grcllm/ISKOpe`
- **URL:** [https://github.com/grcllm/ISKOpe](https://github.com/grcllm/ISKOpe)
- **Description:** Centralized lost-and-found web portal for PUP Manila students.
- **Tech Stack:** PHP, HTML, CSS, JavaScript, MySQL.
- **License Inspection:** Unspecified / proprietary portfolio codebase; lacks a clear OSI-approved permissive open-source license.
- **Legal & Technical Verdict:** **REJECTED.** No explicit license permitting reuse, modification, and redistribution. Relies on legacy LAMP stack (PHP/MySQL) instead of modern Supabase PostgreSQL with RLS and JavaScript CDN SDK.

### Candidate 3: `rafiapanjwani7-afk/lost-and-found-app`
- **URL:** [https://github.com/rafiapanjwani7-afk/lost-and-found-app](https://github.com/rafiapanjwani7-afk/lost-and-found-app)
- **Description:** Student project repository for a lost-and-found portal.
- **License Inspection:** Missing standard license declaration.
- **Technical Verdict:** **REJECTED.** Unmaintained, lacks backend database security, Row Level Security, cryptographic hashing of verification answers, and robust campus identity features.

### Other Explored Repositories
- `litegenix/Lost-and-found-item-portal-web-application` (MIT License): Pure frontend mockup using browser `localStorage` only; lacked Supabase integration, authentication, and secure server-side verification.
- `KashifKhaan/lost_and_found_website` (MIT License): PHP-based monolithic application requiring Apache/MySQL; not adaptable for static Vercel/Netlify hosting.

---

## Decision & Implementation Strategy

Because none of the candidate repositories satisfied both the legal licensing criteria (permissive license permitting modifications and derivative distribution) and the strict technical architecture requirements (Vanilla ES6+ JS, Supabase CDN, Row Level Security, pgcrypto hashing, and static Vercel hosting):

1. **Clean Bespoke Implementation:** A clean, production-grade implementation was engineered from scratch.
2. **Brand & Identity:** An original brand identity, modern university SaaS design language, and custom SVG visual system ("FindIt") were created specifically for MAWTS Institute of Technology.
3. **Security Architecture:** Custom PostgreSQL migrations, Row Level Security (RLS) policies, safe public views (`public_items`, `public_leaderboard`), brute-force protection, and `SECURITY DEFINER` RPC functions (`post_item`, `verify_and_get_contact`) were designed and implemented from the ground up.
4. **Attribution Commitment:** This document serves as the formal record of open-source audit, legal clearance, and design sovereignty for Group 3.
