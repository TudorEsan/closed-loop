// Small design system for the app. Minimal on purpose, easy to extend later.
export const theme = {
  colors: {
    background: '#eeeeee',
    surface: '#ffffff',
    surfaceSoft: '#f5f5f5',
    foreground: '#0a0a0a',
    mutedForeground: '#7a7a7a',
    border: '#e5e5e5',
    success: '#16a34a',
    danger: '#dc2626',
    heroText: '#ffffff',
    glassTint: 'rgba(18, 22, 28, 0.22)',
    glassBorder: 'rgba(255, 255, 255, 0.28)',
    rowBg: 'rgba(0, 0, 0, 0.03)',
    linkBlue: '#2563eb',
    pillBg: '#ffffff',
    overlayDark: 'rgba(0, 0, 0, 0.45)',
  },
  radius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 32,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  font: {
    balance: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
    title: { fontSize: 22, fontWeight: '700' as const },
    sectionTitle: { fontSize: 17, fontWeight: '600' as const },
    body: { fontSize: 15, fontWeight: '500' as const },
    bodySmall: { fontSize: 13, fontWeight: '400' as const },
    caption: { fontSize: 12, fontWeight: '400' as const },
    button: { fontSize: 16, fontWeight: '600' as const },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    },
    soft: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
  },
};

export type Theme = typeof theme;
