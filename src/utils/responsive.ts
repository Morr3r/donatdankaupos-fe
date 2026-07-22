import { useWindowDimensions } from 'react-native';

const PHONE_SHORT_EDGE = 600;

export function getResponsiveLayout(width: number, height: number) {
  const shortEdge = Math.min(width, height);
  const isLandscape = width > height;
  const isPhone = shortEdge < PHONE_SHORT_EDGE;

  return {
    height,
    isLandscape,
    isLandscapePhone: isLandscape && isPhone,
    isPhone,
    isTablet: shortEdge >= PHONE_SHORT_EDGE,
    shortEdge,
    width,
  };
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  return getResponsiveLayout(width, height);
}
