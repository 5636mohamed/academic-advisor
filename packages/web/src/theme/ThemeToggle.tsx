// A single small control, reused in every masthead (advisor, student
// portal, faculty console) and on the login page — one place a session
// can flip night mode on/off, regardless of which party it's signed in as.
import { CSSProperties } from 'react';
import { useTheme } from './ThemeContext';

export function ThemeToggle({ style }: { style?: CSSProperties }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="secondary"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={style}
    >
      {isDark ? '☀️ Light mode' : '🌙 Dark mode'}
    </button>
  );
}
