# Changelog

All notable changes to this project will be documented in this file.

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
