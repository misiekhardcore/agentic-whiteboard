import { fileURLToPath } from "node:url";

import { loadEnvironment } from "@v2/config/env";
import type { NextConfig } from "next";

// The repository keeps its environment files at its root, while Next loads
// them from this app's directory. Loading the root ones here keeps `next build`
// and `next dev` on the same `.env`, `.env.<NODE_ENV>`, `.env.local` and
// `.env.<NODE_ENV>.local` layering; values the environment already exports
// still win.
loadEnvironment(fileURLToPath(new URL("../../", import.meta.url)));

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const nextConfig: NextConfig = {
  transpilePackages: ["@v2/capabilities", "@v2/contracts", "@v2/db"],
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(allowedDevOrigins === undefined ? {} : { allowedDevOrigins }),
};

export default nextConfig;
