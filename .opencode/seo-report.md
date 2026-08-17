# FounderHub SEO Report — Final (2026-08-14)

Target: make **founderhub.site** the strongest Google result for the brand "FounderHub".
Scope: on-page + technical SEO. No black-hat techniques. No features broken (build green).

## 1. Files Changed
| File | Change |
|------|--------|
| frontend/index.html | Full metadata rewrite (title, desc, canonical, OG, Twitter, JSON-LD) |
| frontend/src/components/Seo.tsx | SITE_NAME "FounderHub", DEFAULT_IMAGE /og-image.png, og:image:alt, new `noindex` prop |
| frontend/src/App.tsx | LandingPage + global Helmet title/description → new copy |
| frontend/public/robots.txt | Rewritten (Allow:/ + private disallows + Sitemap line) |
| frontend/public/sitemap.xml | Rewritten (public pages only, /register+/login removed) |
| frontend/public/manifest.webmanifest | name/short_name/description updated |
| frontend/public/og-image.png | NEW — generated 1200x630 (Pillow), 31.8 KB |
| frontend/src/components/Hero.tsx | H1 → "FounderHub — Build, Connect & Grow Your Startup" |
| frontend/src/components/Features.tsx | H2 → "Everything You Need to Build a Startup" |
| frontend/src/components/HowItWorks.tsx | H2 → "Connect With the Right People" |
| frontend/src/components/Testimonials.tsx | H2 → "Why FounderHub?" |
| frontend/src/components/FinalCTA.tsx | H2 → "Get Started With FounderHub" |
| frontend/src/components/ProtectedRoute.tsx | Injects noindex,nofollow meta for ALL authenticated pages |
| frontend/src/components/GuestRoute.tsx | Injects noindex,nofollow meta for login/register pages |
| logo imgs (7 files) | width="36" height="36" added (CLS fix), alt="FounderHub" present |
| 18 files (bulk) | "FounderHub AI" → "FounderHub" (38 replacements) |
| main.py (repo root) | "og-image.png" added to static-file tuple (route serves it in prod) |

## 2. SEO Problems Found (before)
- Title "FounderHub AI — Startup OS" → brand diluted, weak click-through
- Meta description missing/weak
- Canonical pointed to founder-hub-0.vercel.app (stale domain)
- og:image was icons.svg (irrelevant, 0x0 family icon set)
- JSON-LD SearchAction targeted protected /community/hashtag/ URL (error in GSC)
- robots.txt disallowed some public pages; no /api/ block
- sitemap.xml included /register + /login (auth pages — thin/duplicate)
- Landing page had 2+ H1s competing; H2s not keyword-aligned
- Authenticated dashboard pages were indexable (private data exposure risk)
- Inconsistent brand: "FounderHub AI" scattered across 18 files
- Logo images missing width/height → CLS
- /og-image.png would 404 in prod (not in main.py static routes)

## 3. SEO Problems Fixed
All of the above. See table in section 1.

## 4. Final Homepage Title
```
FounderHub — AI Startup Platform for Founders
```

## 5. Final Meta Description
```
FounderHub is an AI-powered startup platform where founders, co-founders, developers, designers, investors, mentors and marketers connect, collaborate and build startups together.
```

## 6. Canonical URL
```
https://founderhub.site/
```
HTTPS-only, no trailing path issues.

## 7. robots.txt Status
- `User-agent: *` + `Allow: /`
- Disallows: /dashboard, /admin, /messages, /meetings, /meet/, /settings, /ai-studio, /ai-matches, /startup-analyzer, /war-room, /explore, /community, /community/, /jobs, /jobs/, /resume-builder, /co-founder, /investor, /business-plan, /business-plan/, /startups/create, /startups/*/edit, /startups/*/analytics, /startups/*/data-room, /startups/*/cap-table, /startups/*/equity, /startups/*/investors, /api/
- `Sitemap: https://founderhub.site/sitemap.xml`
- All public static pages remain crawlable.

## 8. sitemap.xml Status
14 public URLs (absolute, HTTPS): /, /about, /contact, /legal, /privacy, /terms, /cookies, /community-guidelines, /acceptable-use, /intellectual-property, /security, /disclaimer, /investor-disclaimer, /refund-policy. No /register, no /login. Valid XML.

## 9. JSON-LD Schemas Added
- **WebSite** — name FounderHub, url https://founderhub.site/ (removed invalid SearchAction)
- **Organization** — name FounderHub, url, logo https://founderhub.site/logo.png
2 valid blocks in index.html (verified).

## 10. Open Graph Status
og:title, og:description, og:type website, og:url https://founderhub.site/, og:image https://founderhub.site/og-image.png with width 1200, height 630, og:image:alt, og:site_name FounderHub. All present.

## 11. Twitter/X Metadata Status
twitter:card summary_large_image, twitter:title, twitter:description, twitter:image → og-image.png. All present.

## 12. H1 Status
EXACTLY ONE H1 on homepage: "FounderHub — Build, Connect & Grow Your Startup". H2s aligned: "Everything You Need to Build a Startup", "Connect With the Right People", "Why FounderHub?", "Get Started With FounderHub". Verified: no other component renders `<h1>`.

## 13. Image Alt-Text Status
- og-image.png: alt "FounderHub - AI startup platform for founders"
- Logo imgs: alt="FounderHub" + width/height 36x36 (CLS fixed)
- Served in prod: og-image.png route added to main.py static files.

## 14. Build Status
`npm run build` (frontend): **PASS** — tsc -b clean, vite built in 1m25s, exit 0. dist contains index.html (new meta), robots.txt, sitemap.xml, og-image.png, manifest.webmanifest.

## 15. Remaining SEO Issues / Notes
1. **DEPLOY REQUIRED** — live founderhub.site currently serves the STALE build (old title, canonical founder-hub-0.vercel.app, icons.svg og:image). After `git commit` + `git push origin main`, Vercel auto-deploys (buildCommand in vercel.json handles it).
2. After deploy: submit https://founderhub.site/sitemap.xml in Google Search Console and request re-indexing of the homepage. (GSC access belongs to Hashir.)
3. No ranking guarantees — SEO results take time; monitor GSC over 2–4 weeks.
4. Auth pages (login/register) are blocked via on-page noindex meta (GuestRoute), not robots.txt — correct approach.
5. Contact/legal static pages are indexable and in sitemap — intentional.
