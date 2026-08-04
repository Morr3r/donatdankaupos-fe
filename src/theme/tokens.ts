import { Platform } from 'react-native';

export const palette = {
  ink: '#211712',
  inkSoft: '#4A3A32',
  cocoa: '#6B3F2A',
  cocoaDark: '#3B2118',
  rose: '#E88CA4',
  roseSoft: '#F8D6DF',
  honey: '#D99A2B',
  honeySoft: '#FFE7AD',
  cream: '#FFF9F2',
  porcelain: '#FFFDF9',
  white: '#FFFFFF',
  muted: '#7B6C64',
  line: 'rgba(90, 54, 37, 0.13)',
  glass: 'rgba(255, 255, 255, 0.72)',
  glassStrong: 'rgba(255, 255, 255, 0.90)',
  glassDark: 'rgba(47, 27, 20, 0.82)',
  success: '#267A55',
  successSoft: '#DDF4E9',
  danger: '#B93E48',
  dangerSoft: '#FBE2E5',
  info: '#3A68A0',
  infoSoft: '#E3EDF9',
  scrim: 'rgba(31, 18, 13, 0.55)',
  obsidian: '#18100D',
  obsidianSoft: '#2A1A15',
  champagne: '#F3C56B',
  champagneSoft: '#FFF0C8',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const type = {
  display: 'PlayfairDisplay_700Bold',
  displayRegular: 'PlayfairDisplay_600SemiBold',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const shadow = {
  glass: Platform.select({
    web: { boxShadow: '0 10px 22px rgba(91, 46, 32, 0.11)' },
    default: {
      shadowColor: '#5B2E20',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.11,
      shadowRadius: 22,
      elevation: 5,
    },
  }) ?? {},
  floating: Platform.select({
    web: { boxShadow: '0 14px 26px rgba(75, 35, 24, 0.2)' },
    default: {
      shadowColor: '#4B2318',
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.2,
      shadowRadius: 26,
      elevation: 10,
    },
  }) ?? {},
} as const;

export const motion = {
  fast: 160,
  standard: 240,
  slow: 360,
} as const;

export const gradients = {
  background: ['#FFF9F2', '#FFF1E8', '#FBE5E7'] as const,
  primary: ['#5D2F20', '#8A4F34'] as const,
  gold: ['#F3C56B', '#D99725'] as const,
  rose: ['#F5B5C6', '#E789A1'] as const,
  success: ['#3C9B72', '#237552'] as const,
  notification: ['#17100D', '#322019', '#5A3024'] as const,
} as const;
