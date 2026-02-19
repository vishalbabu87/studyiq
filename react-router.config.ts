import type { Config } from "@react-router/dev/config";

// Disable SSR for Vercel deployment - use SPA mode
const ssrEnabled = false;

export default {
  appDirectory: "./src/app",
  ssr: ssrEnabled,
} satisfies Config;
