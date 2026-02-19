import type { Config } from "@react-router/dev/config";

const ssrEnabled = process.env.SSR_MODE !== "false";

export default {
  appDirectory: "./src/app",
  ssr: ssrEnabled,
  routeDiscovery: ssrEnabled ? { mode: "initial" } : undefined,
} satisfies Config;
