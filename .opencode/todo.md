# Mission: Production-Ready SEO for FounderHub (founderhub.site)

> Goal: Brand-focused SEO — make founderhub.site the strongest result for "FounderHub". No black-hat. Don't break features.
> Audit done (2026-08-14): live site serves STALE build (canonical founder-hub-0.vercel.app). Local repo canonical already founderhub.site.

## M1: Core Metadata (index.html + Seo component) | status: completed
### T1.1: index.html rewrite | agent:Worker
- [x] S1.1.1: title → "FounderHub — AI Startup Platform for Founders" | size:S
- [x] S1.1.2: meta description → spec text | size:S
- [x] S1.1.3: OG + Twitter → og-image.png (1200x630), og:type website, og:url https://founderhub.site/ | size:S
- [x] S1.1.4: JSON-LD → WebSite + Organization (name FounderHub, url, logo), remove bad SearchAction | size:M
- [x] S1.1.5: keep lang="en", theme-color, Inter fonts, robots index,follow, favicons | size:S
### T1.2: Seo.tsx component upgrade | agent:Worker
- [x] S1.2.1: SITE_NAME "FounderHub", DEFAULT_IMAGE /og-image.png, add og:image:alt, add noindex prop | size:S
- [x] S1.2.2: LandingPage Seo props in App.tsx → new title/description | size:S

## M2: Public SEO Files (robots + sitemap + manifest + og-image) | status: completed
### T2.1: robots.txt | agent:Worker
- [x] S2.1.1: keep Allow:/ + Sitemap line, keep/verify private-route disallows, block nothing public | size:S
### T2.2: sitemap.xml | agent:Worker
- [x] S2.2.1: remove /register + /login, add public static pages, absolute HTTPS, valid XML | size:S
### T2.3: manifest + og-image.png | agent:Worker
- [x] S2.3.1: manifest name → "FounderHub — AI Startup Platform for Founders" | size:S
- [x] S2.3.2: generate public/og-image.png 1200x630 (Pillow) | size:M
- [x] S2.3.3: main.py static route + "og-image.png" so prod serves it | size:S

## M3: Homepage Structure (H1 + H2s) | status: completed
### T3.1: Heading updates | agent:Worker
- [x] S3.1.1: Hero H1 → "FounderHub — Build, Connect & Grow Your Startup" (exactly one H1) | size:S
- [x] S3.1.2: Features → "Everything You Need to Build a Startup" | size:S
- [x] S3.1.3: HowItWorks → "Connect With the Right People" | size:S
- [x] S3.1.4: Testimonials → "Why FounderHub?" | size:S
- [x] S3.1.5: FinalCTA → "Get Started With FounderHub" | size:S

## M4: Private-Page noindex + Image SEO | status: completed
### T4.1: noindex for authenticated pages | agent:Worker
- [x] S4.1.1: ProtectedRoute injects <meta name="robots" content="noindex, nofollow"> via Helmet | size:S
- [x] S4.1.2: AdminLayout + DashboardLayout noindex (covered by ProtectedRoute; logo width/height added) | size:S
### T4.2: Logo img width/height (CLS) + alt check | agent:Worker
- [x] S4.2.1: add width/height to /logo.png imgs (Navbar, Footer, AppHeader, AuthLayout, DashboardLayout, AdminLayout) | size:S
### T4.3: Brand consistency | agent:Worker
- [x] S4.3.1: bulk "FounderHub AI" → "FounderHub" (38 spots, 18 files) — zero remain | size:S

## M5: Verification | status: completed
### T5.1: Build + validation | agent:Reviewer
- [x] S5.1.1: npm run build passes (tsc + vite, exit 0) — 3m27s, built in 1m25s, exit 0 | size:S
- [x] S5.1.2: verify robots.txt/sitemap.xml/og-image exist; exactly one H1; no noindex on public pages; JSON-LD valid — ALL 7 checks PASS (15:17) | size:M
- [x] S5.1.3: Final SEO report written to .opencode/seo-report.md | size:S
- [x] S5.1.4: status.md updated (100%, pass) | size:S
- [x] S5.1.5: context.md updated (ownership + current status + pending deploy) | size:S

## DONE — ALL 26 SUBTASKS COMPLETE
- Extra: bulk "FounderHub AI" → "FounderHub" (38 spots/18 files); main.py static route + og-image.png; brand consistency everywhere
- PENDING (user action): commit + push → Vercel auto-deploy (live site still STALE)
