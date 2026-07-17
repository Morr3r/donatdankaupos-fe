import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  POS: undefined;
  Orders: undefined;
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
  Settings: undefined;
  Products: undefined;
  ProductEditor: { productId?: string } | undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
