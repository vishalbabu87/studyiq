import { Home, Library, Settings, Upload, BookOpenCheck, Menu, X, ListChecks } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router";

const navItems = [
  { icon: Home, label: "Home", path: "/home" },
  { icon: BookOpenCheck, label: "Quiz", path: "/quiz" },
  { icon: Library, label: "Library", path: "/library" },
  { icon: ListChecks, label: "Tracker", path: "/tracker" },
  { icon: Upload, label: "Upload", path: "/upload" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/home" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl pink-blue-gradient flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
              StudyIQ
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                      isActive
                        ? "pink-blue-gradient text-white shadow-lg"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span className="font-medium text-sm">{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 sm:inline-block">
              Light
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              aria-label="Open menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="px-4 py-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? "pink-blue-gradient text-white"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
