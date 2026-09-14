import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
let pendingNotificationData: Record<string, unknown> | null = null;

export function navigateFromNotificationData(data: Record<string, unknown>) {
  if (!navigationRef.isReady()) {
    pendingNotificationData = data;
    return;
  }
  const route = data.route;
  if (route === 'chat') {
    const conversationId = data.conversationId;
    if (typeof conversationId === 'string') {
      navigationRef.navigate('ChatRoom', { conversationId });
      return;
    }
    navigationRef.navigate('MainTabs', { screen: 'Chat' });
    return;
  }
  if (route === 'order_detail' && typeof data.transactionId === 'string') {
    navigationRef.navigate('OrderDetail', { transactionId: data.transactionId });
    return;
  }
  if (route === 'inventory') {
    navigationRef.navigate('Inventory');
    return;
  }
  if (route === 'unpaid_orders') {
    // focusToken forces the params to change so a repeat tap re-applies the filter.
    navigationRef.navigate('MainTabs', {
      screen: 'Orders',
      params: { status: 'pending', focusToken: Date.now() },
    });
    return;
  }
  navigationRef.navigate('Notifications');
}

export function flushPendingNotificationNavigation() {
  if (!pendingNotificationData) return;
  const data = pendingNotificationData;
  pendingNotificationData = null;
  navigateFromNotificationData(data);
}
