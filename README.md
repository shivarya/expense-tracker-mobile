# Expense Tracker - Mobile App

React Native mobile app for expense tracking and portfolio management.

## Features

- **Dashboard**: Portfolio overview with pie charts, recent transactions, upcoming EMIs
- **Investments**: Track stocks, mutual funds, FDs, and long-term investments
- **Expenses**: View transactions by category with monthly/yearly trends
- **Accounts**: Manage bank accounts and credit cards
- **More**: EMI tracking, categories, sync, and settings

## Tech Stack

- **Framework**: React Native + Expo SDK 54
- **Language**: TypeScript 5.9
- **Navigation**: React Navigation 7 (Bottom Tabs)
- **Charts**: react-native-gifted-charts
- **State**: React Context API
- **HTTP**: Axios
- **Storage**: AsyncStorage

## Prerequisites

- Node.js 20+
- Expo CLI
- Android/iOS device or emulator

## Setup

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Configure API Endpoint (use `.env`)

Copy the template and set the right host for your device/emulator:

```bash
cd mobile
cp .env.example .env
# edit .env and set API_URL_DEV / API_URL_DEV_PHYSICAL as needed
```

The app loads these values at runtime via `app.config.js` and `Constants.expoConfig.extra`.

Defaults in `.env.example`:
- Android emulator (AVD): `http://10.0.2.2:8000`
- Genymotion: `http://10.0.3.2:8000`
- iOS simulator: `http://localhost:8000`
- Physical device: set `API_URL_DEV_PHYSICAL` to `http://<YOUR_PC_IP>:8000`

You can still override at runtime by editing `.env` and restarting Expo (`npm start -- --clear`).

Quick test URLs:
- Android emulator: `http://10.0.2.2:8000/health`
- Physical device (example): `http://192.168.1.17:8000/health`

### 3. Start Development Server

```bash
npm start
```

This will open Expo Dev Tools. You can:
- Press `a` to open in Android emulator
- Press `i` to open in iOS simulator
- Scan QR code with Expo Go app on your phone

## Project Structure

```
mobile/
├── App.tsx                    # Main app component
├── index.js                   # Entry point
├── app.json                   # Expo configuration
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
└── src/
    ├── navigation/
    │   └── AppNavigator.tsx   # Bottom tab navigation
    ├── screens/
    │   ├── DashboardScreen.tsx
    │   ├── InvestmentsScreen.tsx
    │   ├── ExpensesScreen.tsx
    │   ├── AccountsScreen.tsx
    │   └── MoreScreen.tsx
    ├── services/
    │   └── api.ts             # API service layer
    ├── contexts/
    │   └── DataContext.tsx    # Global state management
    └── types/
        ├── dashboard.ts       # Dashboard types
        ├── investments.ts     # Investment types
        └── transactions.ts    # Transaction types
```

## API Integration

The app connects to the PHP backend running at `localhost:8000`.

### Key Endpoints Used:
- `GET /dashboard` - Dashboard summary
- `GET /investments` - All investments
- `GET /transactions` - Transaction history
- `GET /accounts` - Bank accounts
- `GET /emis` - EMI list
- `GET /categories` - Expense categories

### Authentication
JWT token stored in AsyncStorage (for future multi-user support).

## Features Implemented

### ✅ Phase 2.1 - Basic Structure
- [x] Expo project setup with TypeScript
- [x] React Navigation with 5 tabs
- [x] API service layer with Axios
- [x] Data Context for state management
- [x] TypeScript types for all entities

### ✅ Phase 2.2 - Screens
- [x] Dashboard with portfolio pie chart
- [x] Investments with 4 tabs (Stocks, MF, FD, Long-term)
- [x] Accounts list with balance display
- [x] Expenses placeholder
- [x] More screen with menu

### ⏳ Phase 2.3 - Advanced Features (Coming Soon)
- [ ] Expense charts (bar, line)
- [ ] Transaction filtering
- [ ] EMI management screen
- [ ] Manual transaction entry
- [ ] SMS reading integration
- [ ] Pull-to-refresh animations

## Development Notes

### Using with Physical Device

1. Make sure your phone and computer are on the same Wi-Fi network
2. Find your computer's IP address:
   ```bash
   # Windows
   ipconfig
   # Look for "IPv4 Address" under your Wi-Fi adapter
   
   # Mac/Linux
   ifconfig | grep "inet "
   ```
3. Update `src/services/api.ts` with your IP:
   ```typescript
   this.baseURL = 'http://192.168.x.x:8000';  // Replace with your IP
   ```

### Testing with Mock Data

If the PHP server isn't running, the app will show error states. You can:
1. Start the PHP server: `cd ../server && php -S 0.0.0.0:8000`
2. Or modify `DataContext.tsx` to use mock data for testing

## Troubleshooting

### "Network Error" or "Connection Refused"
- Verify PHP server is running: `curl http://localhost:8000/health`
- Check API baseURL in `api.ts` matches your server
- For Android emulator, use `10.0.2.2` instead of `localhost`
- For physical device, ensure firewall allows port 8000

### "Unable to resolve module"
- Clear cache: `npx expo start --clear`
- Reinstall: `rm -rf node_modules && npm install`

### Charts not displaying
- Ensure `react-native-svg` is installed
- Restart Expo dev server

## Scripts

```bash
npm start          # Start Expo dev server
npm run android    # Open in Android emulator
npm run ios        # Open in iOS simulator
npm run web        # Open in web browser
npm test           # Run tests
npm run lint       # Lint code
```

## Next Steps

1. Implement expense charts with category breakdown
2. Add transaction filtering and search
3. Build EMI management screen
4. Integrate SMS reading for automatic transaction capture
5. Add manual transaction entry form
6. Implement data sync with progress indicators

## Dependencies

Key packages:
- `expo`: ~54.0.0
- `react-native`: 0.81.5
- `@react-navigation/native`: ^7.0.0
- `react-native-gifted-charts`: ^1.4.0
- `axios`: ^1.7.0
- `@react-native-async-storage/async-storage`: 2.1.0

See `package.json` for complete list.

---

**Status**: ✅ Basic mobile app functional with Dashboard, Investments, and Accounts screens.
