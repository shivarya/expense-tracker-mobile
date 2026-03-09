# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Android home-screen widget infrastructure with size-aware small, medium, and large layouts for monthly spend, savings, portfolio, and top-category summaries.
- Dedicated `/widget/summary` server endpoint plus app-to-widget snapshot sync so the widget can refresh from app state and conservative background fetches.
- Widget deep links for Dashboard, Investments, and current-month Expenses, plus manual widget refresh support.

### Changed
- Refined widget monthly spend chart readability with clearer trend labels and explicit This/Last/Avg context.
- Improved widget graph behavior to avoid future-month labels and suppress zero-value bars that can look like assumed data.

### Google Play Notes (Draft)
- New home-screen Expense Tracker widget with monthly Spent, Income, Top category, and Balance at a glance.
- Added monthly spend chart in the widget with clearer trend context and quick comparison details.
- Improved widget layout handling across different widget sizes for a cleaner and more stable look.
- Better widget data accuracy in chart labels and month display.

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
