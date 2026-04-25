export const THEME_STORAGE_KEY = 'cube-scanner.theme';

export type ThemeName = 'light' | 'dark';

function isThemeName(value: unknown): value is ThemeName {
  return value === 'light' || value === 'dark';
}

// Synchronous reads/writes via localStorage so the initial theme is set
// before first paint — IndexedDB would cause a flash of the wrong theme.
// All access is wrapped in try/catch because Safari private mode and locked-
// down WebViews can throw on storage access.
export function readStoredTheme(): ThemeName | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(value: ThemeName): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // Storage disabled — preference just won't persist this session.
  }
}
