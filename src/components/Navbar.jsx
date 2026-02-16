import { Home, Library, Moon, Settings, Sun, Upload, BookOpenCheck, Menu, X, ListChecks } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router";
import { useTheme } from "@/contexts/ThemeContext";

const navItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: BookOpenCheck, label: "Quiz", path: "/quiz" },
  { icon: Library, label: "Library", path: "/library" },
  { icon: ListChecks, label: "Tracker", path: "/tracker" },
  { icon: Upload, label: "Upload", path: "/upload" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function Navbar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <a href="/home" className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-2xl pink-blue-gradient text-white shadow-lg">
            S
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-50">StudyIQ</span>
        </a>

        <div className="hidden items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/90 px-1 py-1 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/70 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-all ${
                  active
                    ? "pink-blue-gradient text-white shadow-md"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="relative h-9 w-16 rounded-full border border-slate-200 bg-white p-1 transition-all dark:border-slate-700 dark:bg-slate-900"
            aria-label="Toggle theme"
          >
            <span className={`absolute top-1 h-7 w-7 rounded-full pink-blue-gradient shadow-md transition-all ${theme === "dark" ? "left-1" : "left-8"}`} />
            <span className="absolute left-2 top-2.5 text-slate-700 dark:text-slate-300">
              <Moon size={12} />
            </span>
            <span className="absolute right-2 top-2.5 text-slate-700 dark:text-slate-300">
              <Sun size={12} />
            </span>
          </button>
          <button
            type="button"
            className="rounded-xl bg-white p-2 text-slate-700 md:hidden dark:bg-slate-900 dark:text-slate-200"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200/70 bg-white/95 p-3 md:hidden dark:border-slate-800/70 dark:bg-slate-950/90">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={() => setMobileOpen(false)}
                className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
                  active
                    ? "pink-blue-gradient text-white"
                    : "text-slate-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-900"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </a>
            );
          })}
        </div>
      )}
    </nav>
  );
}
