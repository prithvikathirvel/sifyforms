# SifyForms

SifyForms is a React/Vite form builder with an Express/Prisma backend. The repository contains an editor, published respondent forms, DMS uploads, assessments, payments, and organization/team access controls.

## Review and production documentation

This repository includes a detailed static review of the current implementation:

- [Form Builder and Public Form Security Review](docs/FORM_BUILDER_PUBLIC_FORM_SECURITY_REVIEW.md) — request/response exposure, frontend and backend validation, authentication, authorization/IDOR, XSS, SSRF, injection, abuse, file/DMS, payment, CAPTCHA/OTP, privacy, integrity, safe Burp-style attack examples, and release recommendations.
- [Security Issues Register](docs/SECURITY_ISSUES.md) — consolidated severity-ordered issue list, including the focused 2026-08-28 findings and prior DMS work.
- [Production Readiness and Scale Plan](docs/PRODUCTION_READINESS_AND_SCALE.md) — target architecture, database/caching/queue design, rate limits, CDN/WAF, observability, capacity formulas, load testing, resilience, and launch gates for approximately 1,000,000 members and 300,000 concurrent users/submissions.
- [Edit, Preview, and Premium Form Guide](docs/EDIT_PREVIEW_AND_PREMIUM_FORM_GUIDE.md) — recommended Edit and draft Preview workflows plus a rich, accessible, high-trust exam-registration experience.
- [Editor UI Redesign Plan](docs/EDITOR_UI_REDESIGN_PLAN.md) — enterprise SaaS information architecture, field-inspector layout, responsive behavior, technology guidance, and UI-only acceptance criteria.

> **Current release status:** not production-ready for hostile public traffic or the stated peak workload. The documentation is a static source review; no live exploit or load test was performed. Address all Critical/High blockers and run the documented authorization, security, resilience, and capacity tests before launch.

## Development commands

From the repository root:

```bash
npm install
npm run dev
npm run build
npm run lint
```

The backend has its own package and scripts under `backend/`. Backend dependency installation and Prisma generation require the environment's native build tools and network access to Prisma engines. Verify those steps in CI before treating a backend build as a release gate.

## Deployment notes

- Use same-origin relative API calls or an explicitly configured reverse proxy for browser-facing production traffic; do not rely on a `localhost` fallback.
- Keep production secrets in a secret manager or deployment environment, never in tracked configuration.
- Treat the API as the security boundary: frontend validation, hidden fields, client OTP/CAPTCHA, payment callbacks, and UI permissions are not authorization or integrity controls.
