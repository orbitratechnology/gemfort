import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

/** AUDIT --ease-out: cubic-bezier(0.23, 1, 0.32, 1) */
export const easeOut = Easing.bezier(0.23, 1, 0.32, 1);

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
