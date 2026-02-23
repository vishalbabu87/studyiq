import type { Config } from "@react-router/dev/config";

// Always keep SSR enabled for this backend service so /api/* routes are built.
const ssrEnabled = true;

export default {
  appDirectory: "./src/app",
  ssr: ssrEnabled,
} satisfies Config;
