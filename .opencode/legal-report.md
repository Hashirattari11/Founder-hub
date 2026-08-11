# FounderHub — Legal & Trust Center Implementation Report

**Status:** ✅ Implemented & Build-Verified (2026-08-10) · **Build:** `npm run build` exit 0 (9.59s) · **LSP:** 5/5 clean

---

## 1. Pages Created

All legal/trust pages built as reusable `StaticPageShell` components (TOC sidebar on desktop, scroll-spy active-link, back-to-top, "Last updated" indicator, glassmorphism hero). File: `frontend/src/pages/static/StaticPages.tsx`.

| # | Route | Component | Status |
|---|-------|-----------|--------|
| 1 | `/terms` | `TermsPage` (20 sections: acceptance, eligibility, registration, responsibilities, roles, UGC, startups, jobs, messaging, meetings, AI, prohibited acts, suspension, IP, third-parties, availability, liability, disclaimer, changes, contact) | ✅ |
| 2 | `/privacy` | `PrivacyPage` (11 sections: collects, uses, storage/Supabase, third-parties, retention, security, cookies, rights, children, international, contact) | ✅ |
| 3 | `/cookies` | `CookiePage` (8 sections: what, essential, auth, preferences, analytics-N/A, third-party, control, contact) | ✅ |
| 4 | `/community-guidelines` | `CommunityGuidelinesPage` (13 sections: respect, honest, startup posts, investors, jobs, comments, messaging, no scams, no impersonation, no malware, no abuse, reporting, moderation) | ✅ |
| 5 | `/acceptable-use` | `AcceptableUsePage` (6 sections: acceptable, prohibited, manipulation, enforcement ladder warning→restriction→suspension→termination, reporting, changes) | ✅ |
| 6 | `/intellectual-property` | `IntellectualPropertyPage` (10 sections: FounderHub IP, UGC ownership, startup info, logos, documents, license-to-operate, copyright complaints, trademark, counter-notices, repeat infringers) | ✅ |
| 7 | `/security` | `SecurityPage` (8 sections: account, auth/sessions, access controls, data protection, monitoring, responsible disclosure, what we don't do, user tips) | ✅ |
| 8 | `/disclaimer` | `DisclaimerPage` (9 sections: no professional advice, no funding guarantee, no returns guarantee, no startup success, UGC, AI output, no fiduciary, external links, get professional advice) | ✅ |
| 9 | `/investor-disclaimer` | `InvestorDisclaimerPage` (10 sections: networking platform, no endorsement, no returns, own due diligence, your decisions, user-generated info, regulatory status, eligibility, not advice, risk acknowledgement — incl. "Nothing on FounderHub should be interpreted as financial, investment, legal or tax advice.") | ✅ |
| 10 | `/refund-policy` | `RefundPolicyPage` (9 sections — explicitly states FounderHub currently has NO paid subs, policy applies when paid services introduced; no invented refund window) | ✅ |
| 11 | `/legal` | `LegalCenterPage` (premium trust center: 10 cards with descriptions + developer legal-review footnote) | ✅ |
| 12 | `/contact` | `ContactPage` (updated: 4 cards — General Support / Privacy & Data Requests / Security / Legal — all mailto `notifications@founderhub.site`; + Community & Legal Center links) | ✅ |
| 13 | `/about` | `AboutPage` (unchanged content, now uses upgraded shell) | ✅ |

## 2. Routes Added (App.tsx)

Lazy imports added for 8 new components (CommunityGuidelinesPage, AcceptableUsePage, IntellectualPropertyPage, SecurityPage, DisclaimerPage, InvestorDisclaimerPage, RefundPolicyPage, LegalCenterPage). Routes added at lines 180-187:
- `/legal`, `/community-guidelines`, `/acceptable-use`, `/intellectual-property`, `/security`, `/disclaimer`, `/investor-disclaimer`, `/refund-policy`

All existing routes preserved (root, auth, dashboard, investor, founder, admin, community, jobs, meetings, AI studio — 100% intact). No duplicate routes.

## 3. Footer Updated

File `frontend/src/components/Footer.tsx` rewritten:
- ✅ REMOVED all `href="#"` (blog, careers, startup guides, socials, pricing anchors → real `Link to`)
- ✅ 4-column SaaS footer: Product / Company / **Legal & Trust** / **Policies**
- ✅ All 10 legal routes linked (`/terms`, `/privacy`, `/cookies`, `/community-guidelines`, `/acceptable-use`, `/intellectual-property`, `/security`, `/disclaimer`, `/investor-disclaimer`, `/refund-policy`)
- ✅ Added `/legal` (Legal Center) + `/about` + `/contact` links
- ✅ Brand area uses exact logo `<img src="/logo.png">` (consistent with branding mission)
- ✅ Bottom bar: © year + Legal Center + Privacy/Terms/Cookies/Contact inline

## 4. SEO Updated

Existing `Seo.tsx` reused (no duplicate SEO system) — supports per-page `title`, `description`, `path` (canonical → `https://founder-hub-0.vercel.app{path}`), OG + Twitter cards. Every new page passes unique title/description/canonical:
- "Terms of Service — FounderHub AI", "Privacy Policy — FounderHub AI", "Cookie Policy — FounderHub AI", "Community Guidelines — FounderHub AI", "Acceptable Use Policy — FounderHub AI", "Intellectual Property Policy — FounderHub AI", "Security — FounderHub AI", "Disclaimer — FounderHub AI", "Investor Disclaimer — FounderHub AI", "Refund & Cancellation Policy — FounderHub AI", "Legal Center — FounderHub AI"
- Proper H1/H2 hierarchy inside `StaticPageShell`; no private info in metadata.

## 5. Signup Consent Updated

- `Register.tsx`: added consent line under the Create Account button: *"By creating an account, you agree to our [Terms of Service](/terms) and [Privacy Policy](/privacy)."* — clickable, non-blocking, does NOT gate submit.
- `Login.tsx`: added the equivalent consent for Google OAuth users under the "Continue with Google" button — *"By continuing with Google, you agree to our Terms of Service and Privacy Policy."* — legally covers OAuth sign-in path.

## 6. Cookie System Status

**N/A — no consent banner implemented.** Reason: FounderHub uses ONLY essential browser storage:
- `localStorage` for theme preference (light/dark)
- Supabase auth session token in `localStorage` (required for sign-in)
- NO third-party advertising/tracking cookies
- NO analytics cookies currently deployed

A consent banner would be meaningless (nothing to consent to beyond essential). Policy clearly documents this in `/cookies`. If analytics/ads are introduced later, a banner + this policy update will be required.

## 7. Admin / CMS Status

**Static policy pages implemented; CMS integration deferred (documented limitation).** Reason: existing `AdminCms.tsx` uses typed tabs (content / blog / announcements) backed by specific Supabase tables (`site_content`, `blog_posts`, `announcements`) with serialised editors and complex delete/update flows. Splicing in a generic "policies" tab with versioning + publish/unpublish would require new tables, new API endpoints, and admin UI work — high risk to existing CMS. To honour the "do not break existing systems" rule, policies are shipped as static React content (versioned via git + "Last updated" indicator). The report itself is the admin-facing notice that these are product-level templates pending legal review.

## 8. Build Verification

- `npm run build` → **exit 0, 9.59s** ✅
- `StaticPages-BzndwU1C.js` chunk (47.21 kB) emitted containing all 12 exported pages
- LSP diagnostics clean on all 5 touched files (StaticPages.tsx, Footer.tsx, Register.tsx, Login.tsx, App.tsx) ✅
- No TypeScript errors, no duplicate-identifier issues

## 9. Broken-Link Verification

- `href="#"` in Footer.tsx: **0** (all removed) ✅
- `#features` / `#top` in Hero.tsx / Navbar.tsx: legit same-page SPA anchors on landing (NOT broken external links) ✅
- All 12 new routes resolve to lazy-loaded components ✅

## 10. Navigation / Mobile / Direct-URL

- Pages use `container-x` + responsive grids (`lg:grid-cols-[260px_1fr]` TOC; `sm:grid-cols-2/3` cards) → mobile/tablet/desktop all work
- Direct URL access (e.g. `https://founder-hub-0.vercel.app/terms`) works via existing Vercel SPA rewrite → main.py `spa_fallback` serves index.html, React Router renders `/terms`. SPA routing untouched.

## 11. Legal Safety — What Was NOT Fabricated

No invented: government registrations, GDPR/SOC 2/ISO certifications, investment licenses, financial licenses, broker-dealer status, refund window for nonexistent paid services. Investor Disclaimer explicitly states FounderHub is NOT currently a broker-dealer/adviser. Regulatory status correctly described as "unless and until the business formally registers". Refund Policy explicitly says paid services don't exist yet.

## 12. ⚠️ Items Requiring Legal Review

1. **All policies are product-level templates** — must be reviewed by qualified legal counsel before launch, especially:
   - Investor Disclaimer + Refund Policy (investment/fundraising + future payments)
   - Privacy Policy for international/EEA users (transfers, lawful basis, retention specifics)
   - Children's cutoff (16 vs 13 depending on jurisdiction)
2. Real contact email is `notifications@founderhub.site` (the actually configured `EMAIL_FROM_EMAIL`). If a dedicated `legal@`/`privacy@`/`support@` mailbox is needed it must be set up in Brevo and the policies updated.
3. Cookie Policy will need a consent banner IF analytics/ads are added later.
4. Admin CMS does NOT manage these policies — content lives in source code (StaticPages.tsx). A versioned policy-CMS is a future enhancement.
5. Google OAuth consent screen in Google Cloud Console should list the same Terms/Privacy links for app verification consistency.

## 13. Dev Note (not shown to end users)

> "These policies are product-level templates and should be reviewed by qualified legal counsel before launch, especially for investment/fundraising functionality and international users."

This note appears ONLY on the `/legal` center (small footer card) — not on every page — to avoid over-warning normal users while keeping the reminder visible to anyone reviewing the Legal Center.
