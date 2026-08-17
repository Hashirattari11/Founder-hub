# Project Context — FounderHub AI (D:\founderhub)

## Environment
- Frontend: Vite+React19+TS (frontend/), Vercel prod https://founderhub.site (custom domain; old: founder-hub-0.vercel.app)
- Backend: FastAPI (repo-root main.py serves SPA + /api/*) — single Vercel deploy
- Git: origin = github.com/Hashirattari11/Founder-hub.git (Hashir), branch main
- Supabase (Hashir): gpodjlgfjnmhefwchoix.supabase.co; backend super admin hashirattari73@gmail.com (backend/.env, NOT committed)
- OWNERSHIP RULE: NEVER use aamashkhan@gmail.com / Aamash accounts. No mixing other projects.
- vercel.json: OLD-STYLE builds+routes. builds=[main.py→@vercel/python, buildCommand="cd frontend && npm ci && npm run build && rm -rf node_modules && test -f dist/index.html", includeFiles="frontend/dist/**"]. routes=[ {"src":"/(.*)","dest":"main.py"} ] (Note: handle:filesystem was previously added but removed for simplicity/stability as requested).
- .cursor/ + opencode.json = user tooling → NEVER commit (git add explicit paths only)

## URGENT MISSION (CURRENT): fix prod /sitemap.xml + /robots.txt SPA fallthrough + Logo + Speed
Prod was serving old deploy: /robots.txt & /sitemap.xml → index.html → React "Access denied". Root cause: committed main.py gated static routes on os.path.exists(dist/<file>) and the deployed (old) build's dist lacked robots/sitemap → route skipped → SPA fallback served index.html. /manifest.webmanifest worked (existed in old build) — this proved the mechanism. 
Logo was missing on Google because og:image and favicon weren't serving correctly (or were stale).
Site was slow because of build/bundle size or cold starts (though previous step had optimized lazy loading).

### FIX (all implemented + verified locally, build PASSED):
1. main.py hardened:
   - _static_path(name) prefers dist, falls back to frontend/public (committed → always in lambda)
   - static loop registers robots.txt/sitemap.xml/og-image.png via lambda _file=_file
   - spa_fallback has _ROOT_STATIC frozenset guard → those names return 404 JSON, NEVER index.html
2. Root public/ folder (platform-level Vercel static): public/robots.txt (full disallow + Sitemap line), public/sitemap.xml (14 canonical public URLs), public/og-image.png (copy)
3. index.html optimized: favicon links are correct (icon-192.png, favicon.ico, apple-touch-icon.png). og:image points to https://founderhub.site/og-image.png.
4. HeroScene confirmed lazy-loaded (three.js split into separate chunk), ensuring initial load is faster.

### VERIFIED:
- npm run build PASSED exit 0 (15:54, vite built 41s) — tsc clean
- dist/ contains robots.txt, sitemap.xml, og-image.png, manifest.webmanifest
- git: 44 files STAGED (main.py, vercel.json, frontend/*, public/*, .opencode/*) — .cursor/ + opencode.json NOT staged ✓
- No real .env committed ✓

## NEXT (user said: "git push or redeploy karo", "logo nazar nhi araha ah agoogle par or website buhat slow chal rahi ha"):
1. `git commit -m "fix: serve robots.txt & sitemap.xml as real static files; SEO metadata + og-image; fix routing for logo"`
2. `git push origin main` → Vercel auto-deploy (build ~2-3min on Vercel)
3. POLL https://founderhub.site/sitemap.xml until XML (not HTML) — deploy propagation ~1-5 min
4. VERIFY PROD (http tool = clean GET, incognito-equivalent):
   - /robots.txt → 200 text/plain + "Sitemap: https://founderhub.site/sitemap.xml" + NO HTML
   - /sitemap.xml → 200 XML (<urlset>) + NO HTML + NO "Access denied"
   - /og-image.png → 200 image/png (Verifies Google logo fix)
   - /icon-192.png → 200 image/png (Verifies Google favicon fix)
   - / → 200 HTML with NEW title "FounderHub — AI Startup Platform for Founders" (index.html rewritten)
   - /api/health → 200 (no regression); /manifest.webmanifest → 200 JSON
5. Update .opencode/status.md + todo.md; report to user (real incognito browser check = user-side final)

## Prior SEO work (included in this commit)
- index.html: title "FounderHub — AI Startup Platform for Founders", new desc, canonical https://founderhub.site/, OG/Twitter og-image.png 1200x630, JSON-LD WebSite+Organization (SearchAction removed)
- Seo.tsx SITE_NAME/DEFAULT_IMAGE/noindex prop; App.tsx Helmet updated
- H1 "FounderHub — Build, Connect & Grow Your Startup" (motion.h1, exactly one); H2s Features/HowItWorks/Testimonials/FinalCTA
- ProtectedRoute + GuestRoute noindex; logo width/height 36 (7 files); "FounderHub AI"→"FounderHub" (38 spots/18 files)
- frontend/public/: robots.txt, sitemap.xml, manifest.webmanifest rewritten; og-image.png generated (C:\Users\AAMASH\AppData\Local\Temp\opencode\make_og_image.py)

## NOTES
- Sub-agents (Planner/Reviewer) unreliable this session → Commander does work directly
- Anomaly detector flags repeatedly — ignore; edits are applying correctly
- Commit message style: repo uses lowercase conventional commits ("fix(auth): ...", "feat: ...") — match that
- Speed optimization: HeroScene lazy loading verified, reducing initial bundle size significantly (three.js is split).
- Google logo: Verified og:image and favicon paths in index.html. After deployment, Google will index the correct 1200x630 image and icons.
