import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "./src/app",
  ssr: true,
  routeDiscovery: { mode: "initial" },
} satisfies Config;
