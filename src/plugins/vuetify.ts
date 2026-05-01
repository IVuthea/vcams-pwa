import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import { THEME_STORAGE_KEY, readStoredTheme } from '@/utils/themeStorage';

const stored = readStoredTheme();

const prefersDark =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const initialTheme = stored ?? (prefersDark ? 'dark' : 'light');

// Re-export so AppLayout doesn't need to know the storage details.
export { THEME_STORAGE_KEY };

// Light palette derived from the cube icon's blue. The page background is
// a soft cool tint rather than pure white so cards, app bars, and bottom
// nav read as raised surfaces without needing heavy elevation. Primary is
// nudged one step deeper than Material Blue 500 for AA contrast on white,
// and surface-variant gives dividers/disabled fills something to land on.
const lightTheme = {
  dark: false,
  colors: {
    'primary': '#66BB6A',
    'primary-darken-1': '#43A047',
    'secondary': '#64B5F6',
    'accent': '#2E7D32',
    'info': '#0288D1',
    'success': '#2E7D32',
    'warning': '#ED6C02',
    'error': '#C62828',
    'background': '#F4F7FB',
    'surface': '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-variant': '#E7ECF3',
    'on-primary': '#FFFFFF',
    'on-secondary': '#0B2545',
    'on-background': '#1F2937',
    'on-surface': '#1F2937',
    'on-surface-variant': '#3B4252',
  },
};

const darkTheme = {
  dark: true,
  colors: {
    primary: '#66BB6A',
    secondary: '#90CAF9',
    accent: '#2196F3',
    info: '#4FC3F7',
    success: '#66BB6A',
    warning: '#FFA726',
    error: '#EF5350',
    background: '#121212',
    surface: '#1E1E1E',
  },
};

export default createVuetify({
  theme: {
    defaultTheme: initialTheme,
    themes: {
      light: lightTheme,
      dark: darkTheme,
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi },
  },
  defaults: {
    VBtn: { variant: 'flat' },
    VCard: { rounded: 'lg' },
    VTextField: { variant: 'outlined', density: 'comfortable' },
    VSelect: { variant: 'outlined', density: 'comfortable' },
  },
});
