import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LoginScreen, SplashScreen } from './src/screens/LoginScreen';
import { OpenShiftScreen } from './src/screens/OpenShiftScreen';
import { useCatalogStore } from './src/store/catalogStore';
import { useOperationsStore } from './src/store/operationsStore';
import { usePOSStore } from './src/store/posStore';
import { useSessionStore } from './src/store/sessionStore';

export default function App() {
  const [fontsLoaded] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold });
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
    const checkDailyShift = () => refreshShift().catch(() => undefined);
    const timer = setInterval(checkDailyShift, 60_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkDailyShift();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshShift, status]);

  useEffect(() => {
    if (!shift?.id) {
      previousShiftId.current = null;
      return;
    }
    if (previousShiftId.current && previousShiftId.current !== shift.id) {
      clearCart();
      refreshTransactions().catch(() => undefined);
    }
    previousShiftId.current = shift.id;
  }, [clearCart, refreshTransactions, shift?.id]);

  const ready = fontsLoaded && status !== 'bootstrapping' && (status !== 'authenticated' || operationsHydrated);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!ready ? <SplashScreen /> : status === 'unauthenticated' ? <LoginScreen /> : !shift || shift.status !== 'open' ? <OpenShiftScreen /> : <AppNavigator />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
