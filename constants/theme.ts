import { Platform } from 'react-native';

export const theme = {
  colors: {
    blue:           '#007AFF',
    label:          '#000000',
    secondaryLabel: 'rgba(60,60,67,0.6)',
    tertiaryLabel:  'rgba(60,60,67,0.3)',
    bg:             '#F2F2F7',
    surface:        '#FFFFFF',
    surface2:       '#F2F2F7',
    separator:      'rgba(60,60,67,0.29)',
    destructive:    '#FF3B30',
    green:          '#34C759',
  },
  fonts: {
    largeTitle:  { fontSize: 34, fontWeight: '700' as const, letterSpacing: 0.41 },
    title1:      { fontSize: 28, fontWeight: '700' as const, letterSpacing: 0.36 },
    title2:      { fontSize: 22, fontWeight: '700' as const, letterSpacing: 0.35 },
    headline:    { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.41 },
    body:        { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.41 },
    callout:     { fontSize: 16, fontWeight: '400' as const, letterSpacing: -0.32 },
    subheadline: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.24 },
    footnote:    { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.08 },
    caption:     { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0 },
  },
  fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  space: { 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 10:40 },
  radius: { sm:8, md:12, lg:16, xl:20, full:999 },
  shadow: {
    sm: Platform.select({
      ios: { shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:4 },
      android: { elevation: 2 },
    }),
    md: Platform.select({
      ios: { shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.12, shadowRadius:12 },
      android: { elevation: 6 },
    }),
    lg: Platform.select({
      ios: { shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.16, shadowRadius:24 },
      android: { elevation: 12 },
    }),
  },
};
