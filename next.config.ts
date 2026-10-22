import type { NextConfig } from "next";

const config: NextConfig = {
  output: process.env.KERNELHUB_STATIC_EXPORT === "1" ? "export" : undefined,
  basePath: (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, ""),
  trailingSlash: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  ...(process.env.KERNELHUB_STATIC_EXPORT === "1"
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/sw.js",
              headers: [
                {
                  key: "Cache-Control",
                  value: "no-cache, no-store, must-revalidate",
                },
                { key: "Service-Worker-Allowed", value: "/" },
              ],
            },
          ];
        },
      }),
};

export default config;
