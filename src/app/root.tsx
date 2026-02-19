import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Navbar from "@/components/Navbar";
import appStylesHref from "./global.css?url";
import tailwindStylesHref from "../index.css?url";

export const links = () => [
  { rel: "stylesheet", href: appStylesHref },
  { rel: "stylesheet", href: tailwindStylesHref },
  { rel: "manifest", href: "/manifest.webmanifest" },
  { rel: "icon", href: "/icons/icon-192.svg", type: "image/svg+xml" },
];

export function ErrorBoundary() {
  return (
    <div className="min-h-screen bg-app-gradient px-6 py-16 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/60">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Refresh the page. If this continues, reopen the app.
        </p>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <Meta />
        <Links />
      </head>
      <body className="antialiased selection:bg-blue-500/30 transition-colors duration-300">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <div className="bg-app-gradient min-h-screen transition-colors duration-300">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  );
}
