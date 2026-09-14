import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  POS: undefined;
  Orders: { status?: 'pending'; focusToken?: number } | undefined;
  Reports: undefined;
  More: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Checkout: undefined;
  PaymentSuccess: { transactionId: string };
  OrderDetail: { transactionId: string };
  Inventory: undefined;
  Shift: undefined;
  Expenses: undefined;
  ExpenseDetails: { from: string; to: string; rangeLabel: string };
  Settings: undefined;
  Products: undefined;
  ProductEditor: { productId?: string } | undefined;
  Notifications: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
