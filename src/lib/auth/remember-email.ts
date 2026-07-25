import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@gemfort/remembered-email';

export async function loadRememberedEmail(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function saveRememberedEmail(email: string | null): Promise<void> {
  try {
    if (email) {
      await AsyncStorage.setItem(KEY, email);
    } else {
      await AsyncStorage.removeItem(KEY);
    }
  } catch {
    // Non-critical preference — ignore storage failures.
  }
}
