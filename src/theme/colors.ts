/**
 * Catppuccin Mocha Theme - matching wynter-code desktop app
 */
export const colors = {
  // Backgrounds
  bg: {
    primary: '#141420',
    secondary: '#0f0f18',
    tertiary: '#0a0a10',
    hover: '#252535',
    card: '#1a1a2e',
  },

  // Text
  text: {
    primary: '#cdd6f4',
    secondary: '#a6adc8',
    muted: '#6c7086',
  },

  // Borders
  border: '#2a2a3a',

  // Accent Colors (Catppuccin palette)
  accent: {
    purple: '#cba6f7',
    green: '#a6e3a1',
    red: '#f38ba8',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    cyan: '#94e2d5',
    pink: '#f5c2e7',
    orange: '#fab387',
  },

  // Status Colors
  status: {
    open: '#89b4fa',
    inProgress: '#f9e2af',
    done: '#a6e3a1',
  },
} as const;
