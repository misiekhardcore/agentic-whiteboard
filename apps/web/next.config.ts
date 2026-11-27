import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

// The repository keeps one `.env` at its root, while Next loads env files from
// this app's directory. Loading the root file here makes the README's
// `cp .env.example .env` true for both `next build` and `next dev`; values the
// environment already exports still win.
try {
  process.loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url)));
} catch {
  // A deployment that injects its environment has no file to load.
}

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
