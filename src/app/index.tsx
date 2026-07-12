import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { hasCompletedOnboarding } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

/** Matches expo-splash-screen plugin backgroundColor in app.config.ts */
const BOOT_BG = '#001618';

export default function Index() {
  const { isLoading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    hasCompletedOnboarding().then((done) => {
      setShowOnboarding(!done);
      setReady(true);
    });
  }, []);

  if (authLoading || !ready) {
    return (
      <View style={styles.boot} accessibilityLabel="Loading GemFort">
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  if (showOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(marketplace)/(tabs)/home" />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: BOOT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
