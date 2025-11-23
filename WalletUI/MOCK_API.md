# Mock API Setup

The Wallet UI includes a mock API system that allows you to develop and test the UI without running the backend Express services.

## Usage

### Enable Mock API

1. Create a `.env` file in the `WalletUI` directory (if it doesn't exist)
2. Add the following line:
   ```
   VITE_USE_MOCK_API=true
   ```

3. Restart your dev server:
   ```bash
   npm run dev
   ```

### Disable Mock API (Use Real Backend)

1. In your `.env` file, set:
   ```
   VITE_USE_MOCK_API=false
   VITE_WALLET_API=http://localhost:5002
   ```

2. Make sure your Wallet Backend is running on port 5002

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_USE_MOCK_API` | Set to `"true"` to use mock API | `false` |
| `VITE_WALLET_API` | Wallet Backend URL (only used when mock is disabled) | `http://localhost:5002` |

## Mock Data

The mock API includes:

- **2 Sample Credentials:**
  - John Doe (issued 3 hours ago)
  - Jane Smith (issued 1 day ago)

- **4 Sample Requests:**
  - 2 Pending requests (Local Bar, Bank XYZ)
  - 1 Approved request (Local Bar)
  - 1 Rejected request (Unknown Service)

## Features

- ✅ Simulates network delays (200-500ms)
- ✅ Supports approve/reject actions
- ✅ Updates request status in real-time
- ✅ Shows visual indicator when mock API is active

## Notes

- The mock API is stored in memory and resets on page refresh
- Changes made through the mock API (approve/reject) persist during the session
- The mock API matches the real API structure exactly

