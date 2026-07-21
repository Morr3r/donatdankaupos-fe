import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { OpenShiftScreen } from './src/screens/OpenShiftScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { useCatalogStore } from './src/store/catalogStore';
import { useOperationsStore } from './src/store/operationsStore';
import { usePOSStore } from './src/store/posStore';
import { useSessionStore } from './src/store/sessionStore';
import { toJakartaDateKey } from './src/utils/date';

export default function App() {
  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold });
  const [introComplete, setIntroComplete] = useState(false);
  const [jakartaDayKey, setJakartaDayKey] = useState(() => toJakartaDateKey());
  const status = useSessionStore((state) => state.status);
  const hydrate = useSessionStore((state) => state.hydrate);
  const shift = useOperationsStore((state) => state.shift);
  const operationsHydrated = useOperationsStore((state) => state.hasHydrated);
  const hydrateOperations = useOperationsStore((state) => state.hydrate);
  const refreshShift = useOperationsStore((state) => state.refreshShift);
  const refreshTransactions = useOperationsStore((state) => state.refreshTransactions);
  const resetOperations = useOperationsStore((state) => state.reset);
  const loadCatalog = useCatalogStore((state) => state.load);
  const resetCatalog = useCatalogStore((state) => state.reset);
  const clearCart = usePOSStore((state) => state.clearCart);
  const previousShiftId = useRef<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.allSettled([hydrateOperations(), loadCatalog()]);
      return;
    }
    resetOperations();
    resetCatalog();
  }, [hydrateOperations, loadCatalog, resetCatalog, resetOperations, status]);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const checkDailyShift = () => {
      setJakartaDayKey(toJakartaDateKey());
      refreshShift().catch(() => undefined);
    };
    const timer = setInterval(checkDailyShift, 60_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkDailyShift();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshShift, status]);

  const dailyShiftId = shift?.status === 'open' && toJakartaDateKey(shift.openedAt) === jakartaDayKey
    ? shift.id
    : null;

  useEffect(() => {
    if (previousShiftId.current && previousShiftId.current !== dailyShiftId) {
      clearCart();
    }
    if (dailyShiftId && previousShiftId.current && previousShiftId.current !== dailyShiftId) {
      refreshTransactions().catch(() => undefined);
    }
    previousShiftId.current = dailyShiftId;
  }, [clearCart, dailyShiftId, refreshTransactions]);

  const ready = fontsLoaded && status !== 'bootstrapping' && (status !== 'authenticated' || operationsHydrated);
  const finishIntro = useCallback(() => setIntroComplete(true), []);

  const appContent = ready
    ? status === 'unauthenticated'
      ? <LoginScreen />
      : !dailyShiftId
        ? <OpenShiftScreen />
        : <AppNavigator />
    : <View style={styles.loadingCanvas} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={introComplete ? 'dark' : 'light'} />
        <View style={styles.appShell}>
          <View
            accessibilityElementsHidden={!introComplete}
            importantForAccessibility={introComplete ? 'auto' : 'no-hide-descendants'}
            style={styles.appContent}
          >
            {appContent}
          </View>
          {!introComplete ? <SplashScreen appReady={ready} onComplete={finishIntro} /> : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: '#FFF9F2' },
  appContent: { flex: 1 },
  loadingCanvas: { flex: 1, backgroundColor: '#140D0A' },
});
