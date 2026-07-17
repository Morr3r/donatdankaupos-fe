import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { MainTabParamList } from './types';

const TAB_ROUTES: (keyof MainTabParamList)[] = ['Home', 'POS', 'Orders', 'Reports', 'More'];
const SWIPE_DISTANCE = 56;
const SWIPE_VELOCITY = 520;

type SwipeableTabSceneProps = {
  activeRoute: keyof MainTabParamList;
  children: ReactNode;
  navigation: BottomTabNavigationProp<MainTabParamList>;
};

export function SwipeableTabScene({ activeRoute, children, navigation }: SwipeableTabSceneProps) {
  const swipeGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-14, 14])
    .runOnJS(true)
    .onEnd(({ translationX, translationY, velocityX }) => {
      const isHorizontal = Math.abs(translationX) > Math.abs(translationY) * 1.2;
      const passedThreshold = Math.abs(translationX) >= SWIPE_DISTANCE || Math.abs(velocityX) >= SWIPE_VELOCITY;

      if (!isHorizontal || !passedThreshold) return;

      const currentIndex = TAB_ROUTES.indexOf(activeRoute);
      const direction = translationX < 0 ? 1 : -1;
      const nextRoute = TAB_ROUTES[currentIndex + direction];

      if (nextRoute) navigation.navigate(nextRoute);
    }), [activeRoute, navigation]);

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.scene}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
});
