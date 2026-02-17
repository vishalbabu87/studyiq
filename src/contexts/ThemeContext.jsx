import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "studyiq-theme";
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    setTheme("light");
    localStorage.setItem(THEME_KEY, "light");
    document.documentElement.classList.remove("dark");
  }, []);

  const toggleTheme = () => {
    setTheme("light");
    localStorage.setItem(THEME_KEY, "light");
    document.documentElement.classList.remove("dark");
  };

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
