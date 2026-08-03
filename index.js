// Notification background handlers must exist before React or Expo Router mount.
import './src/notification-entry';

// Expo Router must be registered last.
import 'expo-router/entry';
