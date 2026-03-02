# Google Play Deployment Guide
## Expense Tracker (Android)

This is the exact step-by-step process to build and publish this app to Google Play.

---

## 1) One-time setup

### 1.1 Accounts
- Google Play Console developer account
- Expo account (for EAS Build)
- Google Cloud project (for Google Sign-In OAuth)

### 1.2 Local tools
Run from your machine:

```bash
node -v
npm -v
```

Recommended:
- Node 20+
- npm 10+

Install EAS CLI (either way works):

```bash
npm install -g eas-cli
```

or use npx without global install:

```bash
npx --yes eas-cli --version
```

### 1.3 Login to Expo

```bash
cd "c:\Users\Ash\Documents\Projects\apps\expense-tracker\mobile"
eas login
```

---

## 2) Confirm app identity and build config

This app is already configured as:
- Android package: `dev.shivarya.expensetracker`
- EAS projectId: `1497933e-c12f-40b0-9cfa-8f2570b53fd0`
- Production build type: `app-bundle` (AAB, required for Play Store)

Verify config files:
- `app.json`
- `eas.json`

---

## 3) Google Sign-In production checklist

Because app auth depends on Google login, ensure these are set in Google Cloud Console:

1. Add Android app with package: `dev.shivarya.expensetracker`
2. Add SHA-1/SHA-256 for release signing key used by Play App Signing
3. Ensure OAuth client used by mobile app is valid for production
4. Keep Web client ID consistent with backend token verification setup

If SHA fingerprints are missing or wrong, production login will fail even if build succeeds.

---

## 4) Security checklist before release

Minimum checks:
- `JWT_SECRET` is strong in server `.env`
- Backend verifies Google ID token audience/issuer properly
- CORS is restricted for production origin(s)
- Debug logging is disabled for production app build
- Health endpoint is public (expected), business APIs are JWT-protected

---

## 5) Build production AAB

From app folder:

```bash
cd "c:\Users\Ash\Documents\Projects\apps\expense-tracker\mobile"
npx --yes eas-cli build --platform android --profile production --non-interactive
```

This will:
- Auto-increment Android versionCode (remote source)
- Build signed `.aab`
- Print build log URL + artifact URL

Example output includes:
- Build logs URL on `expo.dev`
- Final artifact URL ending in `.aab`

---

## 6) Store listing assets

Prepare these in advance:
- App icon: 512x512
- Feature graphic: 1024x500
- Phone screenshots (minimum 2)
- Privacy Policy URL
- Terms URL (optional but recommended)
- Disclaimer URL (recommended)

Use folder:
- `mobile/play-store-assets/`

### Legal URLs for this app

Use these production URLs in Play Console / listing:

- Privacy Policy: `https://shivarya.dev/expense_tracker/privacy.html`
- Terms of Use: `https://shivarya.dev/expense_tracker/terms.html`
- Disclaimer: `https://shivarya.dev/expense_tracker/disclaimer.html`

Local files added in this repo:
- `server/terms.html`
- `server/disclaimer.html`
- `server/privacy.html`

Deploy these files to your cPanel server root path:
- `/home/hm5pno1wummg/public_html/expense_tracker/terms.html`
- `/home/hm5pno1wummg/public_html/expense_tracker/disclaimer.html`
- `/home/hm5pno1wummg/public_html/expense_tracker/privacy.html`

---

## 6.5) Store listing — exact form field values

Fill these in under **Grow > Store presence > Main store listing** in Play Console.

---

### App name *(30 chars max)*
```
Expense Tracker
```

---

### Short description *(80 chars max)*
```
Track expenses, sync bank SMS & gain clear insights into your daily spending.
```

---

### Full description *(4000 chars max)*

```
Expense Tracker helps you take control of your personal finances with zero manual effort.

🔄 AUTO-SYNC FROM BANK SMS
Automatically reads transaction SMS from your bank and categorises them — no manual entry needed. Works with most Indian banks.

📊 SPENDING INSIGHTS
View category-wise breakdowns and monthly spending trends to understand where your money goes.

🗂️ SMART CATEGORIES
Organise transactions into categories like Food & Dining, Transportation, Bills & Utilities, Shopping, Healthcare, and more. Merge or rename categories to match your lifestyle.

📅 MONTHLY OVERVIEW
Dashboard shows your current month's total spend at a glance. Tap to drill into individual transactions filtered by month.

🔐 SECURE GOOGLE SIGN-IN
Your data is tied to your Google account. JWT-protected APIs ensure only you can access your transactions.

📱 BUILT FOR INDIA
Designed with Indian bank SMS formats in mind. Handles multiple message formats from SBI, HDFC, ICICI, Axis, Kotak, and more.

FEATURES AT A GLANCE
• Auto-parse bank SMS transactions
• Category management with custom icons and colours
• Month-wise transaction history
• Dashboard with live spending summary
• Secure sign-in with Google
• Works offline for viewing cached data

This app is built for personal use and individual expense tracking. It does not connect to any bank directly — it reads SMS already delivered to your device.
```

---

### App category
- Category: **Finance**
- Tags (optional): `budget`, `expense`, `money manager`

---

### Content rating
Complete the IARC questionnaire. Expected rating: **Everyone**

Key answers:
- Violence: No
- Sexual content: No
- In-app purchases: No
- Sensitive data (financial info): Yes → answer all SMS / data safety follow-up questions

---

### Contact details
| Field | Value |
|---|---|
| Email | *(your support email, e.g. `ash@shivarya.dev`)* |
| Website | `https://shivarya.dev` |
| Phone | *(leave blank if not applicable)* |

---

### Privacy Policy URL *(required)*
```
https://shivarya.dev/expense_tracker/privacy.html
```

---

### Release notes / What's new *(500 chars max — for first public release)*
```
Initial release of Expense Tracker.

• Auto-sync transactions from bank SMS
• Smart expense categorisation
• Monthly spending dashboard
• Category management with custom icons
• Secure Google Sign-In
```

---

### Data Safety form (required — SMS is sensitive)

| Question | Answer |
|---|---|
| Does your app collect or share user data? | Yes |
| Data types collected | SMS messages (for transaction parsing), Financial info |
| Is SMS data shared with third parties? | No |
| Can users request data deletion? | Yes (delete account) |
| Is data encrypted in transit? | Yes (HTTPS) |

In **Permissions > SMS**, you must also:
1. Go to **App content > Sensitive permissions or APIs**
2. Complete the **SMS permissions declaration**
3. State use case: *"Read bank transaction SMS to auto-categorise expenses — no SMS is stored or shared."*

---

## 7) Create/update release in Play Console

1. Open Google Play Console
2. Select app: Expense Tracker
3. Go to `Testing > Internal testing` first (recommended)
4. Create new release
5. Upload generated `.aab`
6. Add release notes
7. Save and roll out to internal testers

After validation:
1. Go to `Production`
2. Create new release
3. Upload same verified `.aab` (or newer one)
4. Submit for review

---

## 8) Data Safety + Permissions declarations

This app requests sensitive Android permissions (SMS-related). Ensure Play declarations match actual usage.

Current Android permissions include:
- `READ_SMS`
- `RECEIVE_SMS`
- `INTERNET`
- `ACCESS_NETWORK_STATE`
- `POST_NOTIFICATIONS`

In Play Console:
- Complete Data Safety form accurately
- Complete SMS/Call Log permission declaration (if required by your flow)
- Provide clear in-app disclosure and privacy policy language for SMS processing

If declarations are incomplete/inaccurate, release can be rejected.

---

## 9) Post-release verification checklist

After rollout:
- Install from Play internal/prod track
- Verify Google login on release build
- Verify API base URL is production (`shivarya.dev/expense_tracker`)
- Verify dashboard/expenses/transactions load successfully
- Verify category update and sync features
- Monitor backend logs for auth or parsing errors

---

## 10) Subsequent release workflow (quick)

For every new version:

1. Commit code
2. Build:
```bash
npx --yes eas-cli build --platform android --profile production --non-interactive
```
3. Upload `.aab` to Internal testing
4. Smoke test
5. Promote to Production

---

## 11) Troubleshooting

### `eas` command not found
Use npx form:

```bash
npx --yes eas-cli build --platform android --profile production --non-interactive
```

### Build succeeds, Google login fails in release
Usually SHA fingerprint / OAuth config mismatch in Google Cloud Console.

### Play rejects due to permissions
Review SMS permission declarations and update privacy policy + in-app disclosure.

### Wrong API endpoint in production
Check:
- `eas.json` production env values
- `app.config.js` env mapping

---

## 12) Current known-good command

```bash
cd "c:\Users\Ash\Documents\Projects\apps\expense-tracker\mobile" ; npx --yes eas-cli build --platform android --profile production --non-interactive
```

This is the command that successfully produced the latest production AAB for this app.
