import { AccessibilityInfo, Platform } from 'react-native';
import { useEffect, useState } from 'react';

const initialWebPreference = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export function useReducedMotionPreference() {
  const [isReduced, setIsReduced] = useState<boolean | null>(initialWebPreference);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = ({ matches }: MediaQueryListEvent) => setIsReduced(matches);
      setIsReduced(mediaQuery.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    AccessibilityInfo.isReduceMotionEnabled().then(setIsReduced).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReduced);
    return () => subscription.remove();
  }, []);

  return isReduced;
}

export function useReducedMotion() {
  return useReducedMotionPreference() ?? false;
}
