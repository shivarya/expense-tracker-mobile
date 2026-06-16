# Changelog

All notable changes to this project will be documented in this file.

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
