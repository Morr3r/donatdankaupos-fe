import { BlurView } from 'expo-blur';
import { NavigationContainer, DefaultTheme, type LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BarChart3, Home, MoreHorizontal, ReceiptText, ShoppingBag } from 'lucide-react-native';
import { Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/DashboardScreen';
import { POSScreen } from '../screens/POSScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { PaymentSuccessScreen } from '../screens/PaymentSuccessScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { ShiftScreen } from '../screens/ShiftScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProductManagementScreen } from '../screens/ProductManagementScreen';
import { ProductEditorScreen } from '../screens/ProductEditorScreen';
import { palette, radius, shadow, type } from '../theme/tokens';
import { useReducedMotion } from '../utils/useReducedMotion';
import { SwipeableTabScene } from './SwipeableTabScene';
import type { MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.cocoa,
    background: palette.cream,
    card: palette.glassStrong,
    text: palette.ink,
    border: palette.line,
    notification: palette.rose,
  },
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['donatdankau-pos://'],
  config: {
    screens: {
      MainTabs: {
        screens: { Home: 'home', POS: 'pos', Orders: 'orders', Reports: 'reports', More: 'more' },
      },
      Checkout: 'checkout',
      PaymentSuccess: 'payment/success/:transactionId',
      OrderDetail: 'orders/:transactionId',
      Inventory: 'inventory',
      Shift: 'shift',
      Expenses: 'expenses',
      Settings: 'settings',
    },
  },
};

const icons = {
  Home,
  POS: ShoppingBag,
  Orders: ReceiptText,
  Reports: BarChart3,
  More: MoreHorizontal,
};

const labels: Record<keyof MainTabParamList, string> = {
  Home: 'Beranda',
  POS: 'Kasir',
  Orders: 'Transaksi',
  Reports: 'Laporan',
  More: 'Lainnya',
};

const smoothTabTransition = {
  animation: 'timing' as const,
  config: {
    duration: 300,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  },
};

const interpolateTabScene: NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']> = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0.68, 1, 0.68],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [-32, 0, 32],
          extrapolate: 'clamp',
        }),
      },
      {
        scale: current.progress.interpolate({
          inputRange: [-1, 0, 1],
          outputRange: [0.992, 1, 0.992],
          extrapolate: 'clamp',
        }),
      },
    ],
  },
});

function MainTabs() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const Icon = icons[route.name];
        return {
          ...(reduceMotion ? { animation: 'none' as const } : {
            sceneStyleInterpolator: interpolateTabScene,
            transitionSpec: smoothTabTransition,
          }),
          headerShown: false,
          tabBarAccessibilityLabel: labels[route.name],
          tabBarActiveTintColor: palette.cocoa,
          tabBarInactiveTintColor: '#8D7A70',
          tabBarBackground: () => <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFill} />,
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, focused, size }) => (
            <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
              <Icon color={focused ? palette.white : color} size={focused ? 20 : 21} strokeWidth={focused ? 2.3 : 1.9} />
            </View>
          ),
          tabBarLabel: labels[route.name],
          tabBarLabelStyle: styles.tabLabel,
          tabBarStyle: [styles.tabBar, { bottom: Math.max(insets.bottom, 10) + 6 }],
        };
      }}
    >
      <Tab.Screen name="Home">
        {({ navigation }) => <SwipeableTabScene activeRoute="Home" navigation={navigation}><DashboardScreen /></SwipeableTabScene>}
      </Tab.Screen>
      <Tab.Screen name="POS">
        {({ navigation }) => <SwipeableTabScene activeRoute="POS" navigation={navigation}><POSScreen /></SwipeableTabScene>}
      </Tab.Screen>
      <Tab.Screen name="Orders">
        {({ navigation }) => <SwipeableTabScene activeRoute="Orders" navigation={navigation}><OrdersScreen /></SwipeableTabScene>}
      </Tab.Screen>
      <Tab.Screen name="Reports">
        {({ navigation }) => <SwipeableTabScene activeRoute="Reports" navigation={navigation}><ReportsScreen /></SwipeableTabScene>}
      </Tab.Screen>
      <Tab.Screen name="More">
        {({ navigation }) => <SwipeableTabScene activeRoute="More" navigation={navigation}><MoreScreen /></SwipeableTabScene>}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ animation: 'slide_from_right', contentStyle: { backgroundColor: palette.cream }, headerShown: false }}>
        <Stack.Screen component={MainTabs} name="MainTabs" />
        <Stack.Screen component={CheckoutScreen} name="Checkout" options={{ gestureEnabled: true }} />
        <Stack.Screen component={PaymentSuccessScreen} name="PaymentSuccess" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen component={OrderDetailScreen} name="OrderDetail" />
        <Stack.Screen component={InventoryScreen} name="Inventory" />
        <Stack.Screen component={ShiftScreen} name="Shift" />
        <Stack.Screen component={ExpensesScreen} name="Expenses" />
        <Stack.Screen component={SettingsScreen} name="Settings" />
        <Stack.Screen component={ProductManagementScreen} name="Products" />
        <Stack.Screen component={ProductEditorScreen} name="ProductEditor" />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 76,
    paddingTop: 7,
    paddingBottom: 8,
    borderRadius: radius.xl,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    overflow: 'hidden',
    ...shadow.floating,
  },
  tabIcon: { width: 35, height: 30, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: palette.cocoaDark },
  tabLabel: { fontFamily: type.bold, fontSize: 9, marginTop: 2 },
});
