# Changelog

All notable changes to this project will be documented in this file.

## [2.6.2] - 2026-06-21
### Fixed
- **Crash on launch in 2.6.0/2.6.1 release**: `ReferenceError: Property 'FormData' doesn't exist` under the React Native New Architecture. axios 1.13+ references `FormData` at module-load time to detect environment; Hermes was evaluating that BEFORE React Native's `InitializeCore` had set up the polyfill. Fixed by importing `react-native/Libraries/Core/InitializeCore` at the very top of `index.js` so all RN runtime globals (FormData, Blob, URL, fetch, etc.) exist before any other module loads.

### Google Play Notes
- Fixes a crash on launch.

## [2.6.1] - 2026-06-18
### Changed
- **Build hardening (no functional change for users).** `app.config.js` now resolves `.env` relative to `__dirname` instead of `process.cwd()` (Gradle's `export:embed` runs from a different cwd, which silently skipped dotenv on local builds), and the production defaults for `API_URL_PROD` / `GOOGLE_CLIENT_ID` are now the real values so a local build can never ship a placeholder if env loading fails. EAS cloud builds were always fine.

### Google Play Notes
- Internal release; no user-visible changes.

## [2.6.0] - 2026-06-17
### Added
- **Premium tier (Google Play Billing)**: new in-app subscription unlocks Gmail Auto-Sync. Paywall screen at More → Go Premium with monthly (₹99) and yearly (₹799) plans + 7-day free trial. Server verifies purchases via Google Play Developer API.
- **Gmail Auto-Sync (premium)**: connect read-only Gmail from More → Gmail Auto-Sync and the server fetches statement emails automatically (credit cards for SBI/ICICI, CDSL eCAS for stocks + MF, NPS, CAMS mutual funds). Trigger a manual sync with a date-range selector (1M / 2M / 6M / 1Y / All) and see a full sync log with status badges + failure reasons.
- **Statement password pool**: save a list of common PDF passwords (e.g. DOB, PAN). The server tries each when opening protected statement PDFs — no more per-card setup. Passwords are encrypted at rest (AES-256-GCM).
- **Manual investment entry**: new "Add FD / PF / NPS" form (More → Add FD / PF / NPS) for Fixed Deposits and long-term funds (PF / NPS / PPF / Sukanya / VPF), replacing the dropped portal scrapers for distribution.
- **On-device SMS parser (free tier)**: free accounts now parse bank SMS on-device with no server-AI cost. Premium accounts continue using server AI for higher-accuracy parsing.
- **Account deletion page** at `/expense_tracker/delete.html` (linked from Google Play Data Safety).

### Changed
- **Google Sign-In tokens are now properly verified server-side** (signature + audience + email_verified). Previously the server only decoded the token without verifying it — this hardens the app against forged identities ahead of public distribution.
- **AI provider is now configurable per environment** (Gemini / OpenAI / Groq / Azure) via `AI_PROVIDER` env. Categorization is **rules-first** for both SMS and statement transactions — your manual recategorizations override the AI guess automatically.
- **Account deletion** now correctly cascades all related tables (transactions, investments, EMIs, statement uploads, password vaults, sync logs).
- Build now ships 64-bit ABIs only (`arm64-v8a`, `x86_64`) — Play Store requires 64-bit anyway and this shrinks the AAB.

### Fixed
- Critical: `/auth/login` dev backdoor (which minted a session for a hardcoded user id) is now disabled by default and only available behind an explicit dev-only env flag.
- Replaced `react-native-iap` with **`expo-iap`**, the Expo-supported billing library (RN-IAP 15.x needs Nitro Modules infrastructure this project doesn't have; RN-IAP 12.x doesn't compile against RN 0.81).

### Google Play Notes
- New "Add FD / PF / NPS" form to track your fixed deposits and long-term funds (PF, NPS, PPF, Sukanya).
- Statement password manager: save your common PDF passwords once and the app uses them whenever it needs to open a protected statement.
- Faster, more reliable SMS-based transaction detection — parses on your device for free users; cloud-AI parsing available with Premium.
- New Premium subscription unlocks Gmail Auto-Sync — connect your inbox and the app fetches credit-card, mutual-fund, and demat (CDSL) statements for you. Monthly (₹99) and yearly (₹799) plans with a 7-day free trial.
- Security: Google sign-in tokens are now fully verified on the server.

## [2.5.19] - 2026-06-16
### Added
- Foreign currency support for transactions (MYR, USD, etc.). Transaction details now display the original foreign amount (e.g., "Originally MYR 30.00") when applicable.
- FX rate caching via Frankfurter API for accurate historical conversions on transaction dates.

### Fixed
- Fixed duplicate credit-card transactions that were appearing on wrong accounts during sync.
- Corrected SMS-parsed foreign transactions that were stored as tiny INR amounts instead of properly converted values.

### Changed
- Transaction `amount` field now always represents INR (home currency); original foreign amounts are preserved separately for historical accuracy and display.

### Google Play Notes
- Foreign currency transactions now show their original amount in transaction details (e.g., "Originally MYR 30.00").
- Amounts and totals remain in INR for consistency. Fixed duplicate card transactions appearing on wrong accounts.

## [2.5.18] - 2026-03-25
### Added
- Transaction search filter in Transactions screen by keyword (merchant, description, account, bank).
- Amount range filter in Transactions screen with Min and Max values.

### Changed
- Search and amount filters now work with existing month/date, type, category, group, and trip/event filters using AND behavior.
- Filter summary now displays active search and amount range badges for quick visibility.

### Fixed
- Transactions summary counts now stay aligned with list results when keyword and amount filters are applied.

### Google Play Notes
- Added transaction search by keyword so you can find entries faster.
- Added amount range filtering (Min and Max) for more precise transaction lookup.
- Search and amount filters now work together with your existing filters.
- Improved filter clarity with visible search and amount badges.

## [2.5.12] - 2026-03-21
### Added
- Local Android production build commands: `build:production:local` and `build:production:local:no-bump`.
- Emulator cleanup helper script to free storage before installs: `android:free-space`.
### Changed
- Transactions list now uses device-local date and time formatting again.
### Fixed
- Restored visible transaction dates in list rows (date + time now shown together).

### Google Play Notes
- Fixed transaction list date visibility so date and time are shown clearly.
- Improved local time display behavior in transaction rows.
- Added reliability helpers for local Android builds and emulator storage cleanup.

## [2.5.11] - 2026-03-18
### Added
- Merchant name edit in Transactions details (in-app).
- 50-item pagination for Transactions list (load more on scroll).
### Fixed
- Fixed false 409 on refund-allocation by hardening overlay-table detection (migration 012 check).
- Corrected misclassified transactions from statement uploads (audit & DB fix applied).
- Improved SMS & statement parsing normalization to reduce future misclassifications.
### Changed
- Client/server improvements for clearer API error messages and duplicate detection counters.
### Google Play Notes
- Fixes for refund allocation and transaction misclassification.
- Edit merchant names directly from Transaction details.
- Faster Transactions list with 50-item pagination and smooth load-more.
- General stability and sync reliability improvements.

## [2.5.8] - 2026-03-17
### Added
- Manual "Re-sync Last 30 Days Now" action in More screen to force a 30-day re-sync.
- SMS sync hook: support `forceLookbackDays` and return richer duplicate-validation counters to the UI (high-confidence skips, flagged possible duplicates, AI-checked transactions, duplicate-fallback usage).
### Changed
- Transactions list now displays local time on each row and includes an eye icon to open a detailed transaction sheet.
### Fixed
- Fixed an issue where transactions sometimes displayed 12:00 AM due to AI-parsed date-only values — the server now preserves SMS timestamps and updates duplicate transaction timestamps during re-sync when a more precise time is available.
### Google Play Notes
- Transaction times now show the correct local time (fixes 12:00 AM issue).
- One-tap "Re-sync Last 30 Days" available from More screen to manually fetch recent SMS transactions.
- Improved duplicate detection feedback and sync reporting for more reliable imports.
- Miscellaneous bug fixes and stability improvements.

## [2.5.5] - 2026-03-14
### Added
- Transaction Groups management with preset groups for Credit Cards, Home, and Travel.
- Group-based filtering in Expenses and Transactions so users can focus analytics and lists by selected group.

### Changed
- Expenses filters redesigned into a compact summary + edit sheet for cleaner, less cluttered controls.
- Transactions filters redesigned into a compact summary + edit sheet with explicit Apply behavior.
- Month and Group filters now apply together using AND when fetching data.

### Fixed
- First-run group experience now auto-seeds default preset groups, avoiding an empty "All groups only" filter state.

### Google Play Notes
- New preset transaction groups: Credit Cards, Home, and Travel.
- You can now filter Expenses analytics and Transactions by group for faster insights.
- Filters are cleaner and easier to use with a new compact filter panel.
- Month and Group filters now work together for more precise results.

## [2.5.4] - 2026-03-14
### Added
- Android home-screen widget infrastructure with size-aware small, medium, and large layouts for monthly spend, savings, portfolio, and top-category summaries.
- Dedicated `/widget/summary` server endpoint plus app-to-widget snapshot sync so the widget can refresh from app state and conservative background fetches.
- Widget deep links for Dashboard, Investments, and current-month Expenses, plus manual widget refresh support.

### Changed
- Refined widget monthly spend chart readability with clearer trend labels and explicit This/Last/Avg context.
- Improved widget graph behavior to avoid future-month labels and suppress zero-value bars that can look like assumed data.
- Updated EAS build packaging config so native Android widget files are included in production cloud builds.

### Fixed
- Home-screen widget visibility issue on physical devices caused by production builds missing native widget files.

### Google Play Notes (Draft)
- New home-screen Expense Tracker widget with monthly Spent, Income, Top category, and Balance at a glance.
- Added monthly spend chart in the widget with clearer trend context and quick comparison details.
- Improved widget layout handling across different widget sizes for a cleaner and more stable look.
- Better widget data accuracy in chart labels and month display.
- Fixed widget visibility on real devices in production release builds.

## [2.5.0] - 2026-03-05
### Added
- Automatic daily SMS sync trigger on app startup and app foreground resume.
- Android real-time SMS listener bridge path with queued message drain support.
- Auto-sync summary notifications for background-triggered SMS sync runs.

### Changed
- Expanded SMS sync result details in More screen (saved debit/credit counts and latest auto-sync state).
- Improved transaction sync integration with server webhook parsing endpoint.
- Bumped app version to 2.5.0 (android versionCode 5, iOS build 5).

### Fixed
- Expenses period chips now respect top safe area and no longer overlap status bar icons on physical devices.
- Re-tapping the Expenses tab now returns to Expenses overview from nested screens.
- Dashboard deep link to Transactions now preserves expected Expenses back navigation flow.

## [2.4.0] - 2026-03-03
### Added
- AI‑powered categorization now used by scraper/agent path; transactions are enriched with canonical `category_id`, clean merchant names, and meaningful descriptions before sync.
- `CATEGORY_INSTRUCTIONS.md` updated to include Household Help (52), Kids Activities (53), Software & Tools (54) and new description quality rules.

## [2.2.0] - 2026-03-02
### Added
- Delete Account feature: in-app button under More → Account with double-confirm prompt.
- Server-side `DELETE /auth/account` endpoint — permanently removes all user data.
- `delete-account.html` web page for Play Store's account deletion URL requirement.
- Legal section in More screen with in-app links to Terms, Disclaimer, and Privacy Policy.
- Privacy Policy page (`privacy.html`) created and deployed.

### Changed
- Bumped app version to 2.2.0 (android versionCode 4, iOS build 4).

## [2.1.0] - 2026-03-02
### Added
- Master categories screen with CRUD and consolidation features.
- Dashboard banner is now tappable and navigates to current-month transactions.
- New legal pages: Terms of Use and Disclaimer; links added in-app under More → Legal.
- Production Google Play deployment guide updated with store listing fields and legal URLs.

### Changed
- Bumped app version to 2.1.0 (android versionCode 3, iOS build 3).
- Rewrote server `CATEGORY_INSTRUCTIONS.md` post-consolidation.

### Fixed
- Minor styling updates in `MoreScreen` and `DashboardScreen`.

## [2.0.0] - previous release
- Initial public release available on Play Store.
