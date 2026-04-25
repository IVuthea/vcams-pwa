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

const lightTheme = {
  dark: false,
  colors: {
    primary: '#2196F3',
    secondary: '#42A5F5',
    accent: '#1976D2',
    info: '#0288D1',
    success: '#2E7D32',
    warning: '#ED6C02',
    error: '#C62828',
    background: '#FFFFFF',
    surface: '#FFFFFF',
  },
};

const darkTheme = {
  dark: true,
  colors: {
    primary: '#42A5F5',
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
