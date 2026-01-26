# SMS Auto-Sync Implementation

## ✅ What's Implemented

### 1. SMS Reading & Syncing
**File:** `mobile/src/hooks/useSMSSync.ts`

- ✅ Reads SMS from phone inbox
- ✅ Filters bank SMS (HDFC, SBI, ICICI, IDFC, RBL, Axis, Kotak)
- ✅ Syncs new messages since last sync
- ✅ Sends batch to server for AI parsing
- ✅ Tracks last sync timestamp
- ✅ Prevents re-processing same messages

### 2. UI Integration
**File:** `mobile/src/screens/MoreScreen.tsx`

- ✅ "Sync SMS Transactions" button in More screen
- ✅ Loading indicator during sync
- ✅ Success/error alerts
- ✅ Shows last sync time
- ✅ Displays sync results (found, parsed, saved, skipped)
- ✅ Auto-refreshes data after sync

### 3. Features

**Automatic Detection:**
```typescript
// Checks for bank keywords in sender or body
const BANK_KEYWORDS = ['hdfc', 'sbi', 'icici', 'idfc', 'rbl', 'axis', 'kotak', 'credited', 'debited'];
```

**Incremental Sync:**
- Only syncs messages since last sync
- If never synced, gets last 30 days
- Stores timestamp in AsyncStorage

**Server Integration:**
- Calls `POST /api/parse/sms` with batch of messages
- Server parses with Azure OpenAI
- Auto-creates bank accounts and categories
- Prevents duplicates

---

## 📱 How It Works

### User Flow:
1. User opens app → goes to "More" tab
2. Taps "Sync SMS Transactions" button
3. App requests SMS permission (if needed)
4. App reads SMS from phone since last sync
5. Filters only bank SMS
6. Sends to server in batch
7. Server parses with AI and saves transactions
8. App shows results and refreshes data
9. User sees new transactions in Expenses tab

### Example SMS:
```
From: VK-HDFCBK
Body: Rs. 500.00 debited from A/c XX1234 on 20-Jan-26 at SWIGGY. Avl Bal: Rs. 5000.00
```

**Parsed Result:**
```json
{
  "bank": "HDFC",
  "account_number": "1234",
  "transaction_type": "debit",
  "amount": 500.00,
  "merchant": "SWIGGY",
  "category": "Food & Dining",
  "date": "2026-01-20"
}
```

---

## 🔐 Permissions

**Already Configured:**
- ✅ READ_SMS permission in AndroidManifest.xml
- ✅ RECEIVE_SMS permission in AndroidManifest.xml
- ✅ Runtime permission request handled by `useSMSSync` hook

---

## 🚀 Usage

### In Any Screen:
```typescript
import { useSMSSync } from '../hooks/useSMSSync';

const MyScreen = () => {
  const { syncSMS, isSyncing, lastSyncTime } = useSMSSync();

  const handleSync = async () => {
    const result = await syncSMS();
    console.log('Synced:', result);
  };

  return (
    <Button 
      title="Sync SMS" 
      onPress={handleSync} 
      disabled={isSyncing}
    />
  );
};
```

---

## 📊 Sync Results

```typescript
{
  success: true,
  count: 15,        // Total bank SMS found
  parsed: 15,       // Successfully parsed
  saved: 12,        // New transactions saved
  skipped: 3        // Duplicates skipped
}
```

---

## ❌ What's NOT Implemented (Yet)

### Real-time SMS Forwarding
**Requires:** Background SMS receiver (BroadcastReceiver)

**Would need:**
```java
// Android native module
public class SMSReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    // Forward new SMS to server webhook
  }
}
```

**Why not included:**
- Requires native Android code
- Needs background service
- Complex permission handling
- Battery usage concerns

**Current Solution:**
- ✅ Manual sync via button (easier, more reliable)
- ✅ User controls when to sync
- ✅ Better battery life

---

## 🔄 Automatic vs Manual

### Current: Manual Sync ✅
**Pros:**
- Simple implementation
- User controls sync
- No background services
- Better battery life
- Privacy friendly

**Cons:**
- Not real-time
- User must remember to sync

### Future: Real-time Forwarding ⏳
**Pros:**
- Automatic, no user action
- Real-time transaction capture

**Cons:**
- Complex native code
- Background services needed
- Battery usage
- Privacy concerns
- Permission issues

---

## 🧪 Testing

### Test Flow:
1. Build app: `cd mobile && npm run android`
2. Open app → Login with Google
3. Go to "More" tab
4. Tap "Sync SMS Transactions"
5. Grant SMS permission if prompted
6. Wait for sync to complete
7. Check "Expenses" tab for new transactions

### Expected Results:
- Should find bank SMS from last 30 days
- Parse with ~95% accuracy
- Auto-create bank accounts (XXXX1234 format)
- Auto-create categories (Food & Dining, Shopping, etc.)
- Skip duplicates within ±60 minutes

---

## 📝 API Endpoint Used

**POST /api/parse/sms**

Request:
```json
{
  "messages": [
    {
      "sender": "VK-HDFCBK",
      "body": "Rs. 500.00 debited...",
      "date": "2026-01-20T14:30:00.000Z"
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "data": {
    "total_sms": 1,
    "parsed_transactions": 1,
    "saved_transactions": 1,
    "skipped_duplicates": 0,
    "transactions": [...]
  }
}
```

---

## 🎯 Next Steps (Optional)

### For Real-time Forwarding:
1. Create Android BroadcastReceiver module
2. Implement background SMS listener
3. Add webhook forwarding to `/api/parse/sms/webhook`
4. Handle app kill scenarios
5. Optimize battery usage

### For Better UX:
1. Show sync progress (X of Y messages)
2. Add manual refresh button on Expenses screen
3. Show notification on successful sync
4. Add sync schedule (daily, weekly)
5. Export/import SMS data

---

## ✅ Summary

**Current Implementation:**
- ✅ Manual SMS sync via button
- ✅ Reads phone SMS inbox
- ✅ Filters bank messages
- ✅ Sends to server for AI parsing
- ✅ Auto-creates accounts & categories
- ✅ Prevents duplicates
- ✅ Shows sync results
- ✅ Works on Android

**Not Implemented:**
- ❌ Real-time SMS forwarding
- ❌ Background SMS listener
- ❌ Automatic periodic sync

**Recommendation:** 
Start with manual sync (current implementation), add real-time forwarding later if needed. Most users are fine with manual sync once a week.

---

*Last Updated: January 25, 2026*
