import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-white/90 p-8 text-slate-900 shadow-lg dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-100">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
        The page you requested does not exist.
      </p>
      <div className="mt-6">
        <Link
          to="/home"
          className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
