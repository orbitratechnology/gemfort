# Phone Authentication Fixes and Improvements

## Problem
Some devices were not receiving SMS verification codes, showing "Could not send OTP" errors.

## Root Causes Identified

1. **No App Verification Configuration**: The app was not configured to handle app verification (reCAPTCHA fallback), which is required for reliable SMS delivery on some devices.

2. **Poor Error Handling**: Generic error messages didn't help users understand why SMS failed.

3. **No Timeout Handling**: If Firebase didn't respond within a reasonable time, users would hang indefinitely.

4. **Missing Test Phone Numbers**: No way to test phone auth without consuming real SMS quota.

## Fixes Implemented

### 1. App Verification Configuration
Added `configureAppVerification()` function in `src/lib/firebase/phone-auth.native.ts`:

```typescript
function configureAppVerification() {
  const auth = getFirebaseAuth();
  // Only disable app verification in development builds
  if (__DEV__) {
    auth.settings.appVerificationDisabledForTesting = true;
  }
}
```

**Benefits:**
- In development, bypasses reCAPTCHA and automatic verification for faster testing
- In production, uses standard Firebase app verification for security
- Follows react-native-firebase best practices

### 2. Enhanced Error Handling
Improved `verificationIdFromListener()` with specific error messages:

- `auth/quota-exceeded` → "SMS quota exceeded. Please try again later."
- `auth/invalid-phone-number` → "Invalid phone number format. Please check and try again."
- `auth/missing-phone-number` → "Phone number is missing. Please enter a valid number."
- `auth/captcha-check-failed` → "Security check failed. Please try again."

### 3. Timeout Protection
Added 2-minute timeout to prevent indefinite hanging:

```typescript
timeoutHandle = setTimeout(() => {
  if (!settled) {
    settled = true;
    reject(new Error('Verification request timed out. SMS may not have been sent. Please try again.'));
  }
}, 120000);
```

### 4. Better User Feedback
Enhanced error messages in `complete-phone.tsx` to guide users:

```typescript
if (errorMessage.includes("timed out") || errorMessage.includes("SMS")) {
  toast.error(
    `${errorMessage} Make sure you have a stable internet connection and that your device can receive SMS messages.`,
  );
}
```

## Setup Instructions

### 1. Firebase Console Configuration

#### Enable Phone Auth Provider
1. Go to Firebase Console: https://console.firebase.google.com/project/gemfort/authentication/providers
2. Click on "Phone" sign-in provider
3. Enable it

#### Add Test Phone Numbers (Recommended for Development)
1. In the same Phone provider page, click "Phone numbers for testing"
2. Add test numbers (e.g., Sri Lankan numbers):
   - Phone: `+94712345678`
   - Code: `123456`
3. These numbers bypass SMS delivery and use the test code immediately

**Why this matters:**
- Saves SMS quota during development
- Allows testing without waiting for actual SMS
- Works on emulators and simulators where SMS may not work

### 2. iOS Configuration

The `@react-native-firebase/auth` plugin is already configured in `app.config.ts` (line 201), which sets up reCAPTCHA verification automatically.

**Verify URL Scheme:**
The app config already has `scheme: "gemfort"` (line 62). Ensure this matches the REVERSED_CLIENT_ID in your `GoogleService-Info.plist`.

### 3. Android Configuration

The app config already has the Firebase plugin configured (line 200-201). The plugin handles Play Integrity configuration automatically.

**For manual testing without Play Integrity:**
In development builds, the `appVerificationDisabledForTesting` setting will force reCAPTCHA instead of automatic verification.

## Testing

### Using Test Phone Numbers
1. Add test numbers in Firebase Console (see above)
2. Enter the test phone number in the app
3. Enter the test code when prompted
4. Verification succeeds instantly without SMS

### Using Real SMS
1. Use a real phone number (not in test list)
2. Ensure device has:
   - Stable internet connection
   - SMS capability
   - Background refresh enabled (iOS)
3. Enter the code from the SMS

### With agent-device
To test on a physical device using agent-device:

```bash
# Boot Android emulator or connect physical device
# Then use argent tools to navigate through the phone verification flow
```

## Common Issues and Solutions

### Issue: "SMS quota exceeded"
**Solution:**
- Use test phone numbers for development
- Wait for quota to reset (typically daily)
- Check Firebase Console for quota limits

### Issue: "Security check failed" (reCAPTCHA)
**Solution:**
- In development, `appVerificationDisabledForTesting` is already enabled
- In production, ensure device has internet access
- Check if reCAPTCHA is blocked by network/firewall

### Issue: SMS not arriving on iOS
**Solution:**
- Ensure background refresh is enabled for the app
- Check if device is in airplane mode
- Verify the phone number format (E.164: +947xxxxxxxx)
- Try the reCAPTCHA fallback (will happen automatically if SMS fails)

### Issue: SMS not arriving on Android
**Solution:**
- Check if Play Integrity API is accessible
- Ensure device has Google Play Services
- Verify the phone number format
- Try forcing reCAPTCHA by setting `appVerificationDisabledForTesting = true` in dev

## Monitoring

Check Firebase Console for SMS delivery metrics:
1. Go to Firebase Console → Authentication → Sign-in method
2. Click "Phone" provider
3. View usage statistics and error rates

## References

- [React Native Firebase Phone Auth Docs](https://rnfirebase.io/auth/phone-auth)
- [Firebase Phone Auth Best Practices](https://firebase.google.com/docs/auth/ios/phone-auth)
- [Firebase Console - Phone Auth Setup](https://console.firebase.google.com/project/gemfort/authentication/providers)
