import type { NextConfig } from "next";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const nextConfig: NextConfig = {
  transpilePackages: ["@v2/capabilities", "@v2/contracts", "@v2/db"],
  serverExternalPackages: ["pg"],
  ...(allowedDevOrigins === undefined ? {} : { allowedDevOrigins }),
};

export default nextConfig;
