import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "studyiq-theme";
const ThemeContext = createContext(null);

// Get stored theme or default to light
function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  return stored || "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize theme after hydration
  useEffect(() => {
    setThemeState(getInitialTheme());
    setIsHydrated(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;
    
    const root = document.documentElement;

    // Remove all possible theme classes to ensure a clean slate
    root.classList.remove("light", "dark", "theme-lovable");

    // Add the correct class based on the current theme state
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "lovable") {
      root.classList.add("theme-lovable");
    } else {
      root.classList.add("light");
    }
    
    // Persist the theme state to localStorage
    localStorage.setItem(THEME_KEY, theme);
    
    console.log("Theme applied:", theme);
  }, [theme, isHydrated]);

  // Toggle through themes
  const toggleTheme = useMemo(() => {
    return () => {
      setThemeState(currentTheme => {
        if (currentTheme === "light") return "dark";
        if (currentTheme === "dark") return "lovable";
        return "light";
      });
    };
  }, []);

  // Set specific theme directly
  const setTheme = useMemo(() => {
    return (newTheme) => {
      if (newTheme === "light" || newTheme === "dark" || newTheme === "lovable") {
        setThemeState(newTheme);
      }
    };
  }, []);

  const value = useMemo(() => ({ 
    theme, 
    toggleTheme,
    setTheme,
    isHydrated 
  }), [theme, isHydrated]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
}
