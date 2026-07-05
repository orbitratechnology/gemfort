import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { hasCompletedOnboarding } from '@/lib/onboarding';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    hasCompletedOnboarding().then((done) => {
      setShowOnboarding(!done);
      setReady(true);
    });
  }, []);

  if (!ready) return null;

  if (showOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(marketplace)/(tabs)/home" />;
}
