import { index, route } from "@react-router/dev/routes";

export default [
  index("./page.jsx"),
  route("home", "./home/page.jsx"),
  route("quiz", "./quiz/page.jsx"),
  route("craft", "./craft/page.jsx"),
  route("library", "./library/page.jsx"),
  route("tracker", "./tracker/page.jsx"),
  route("upload", "./upload/page.jsx"),
  route("settings", "./settings/page.jsx"),
  // API routes are handled by src/app/api/*/route.js files
  // Removed from here to avoid SSR issues
];
