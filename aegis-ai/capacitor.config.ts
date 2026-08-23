import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.aegis.ai",
  appName: "Aegis AI",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_aegis",
      iconColor: "#22d3ee",
    },
  },
};
export default config;
