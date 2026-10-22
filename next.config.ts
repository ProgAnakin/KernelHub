import type { NextConfig } from "next";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const config: NextConfig = {
  output: process.env.KERNELHUB_STATIC_EXPORT === "1" ? "export" : undefined,
  basePath,
  trailingSlash: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  ...(process.env.KERNELHUB_STATIC_EXPORT === "1"
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "X-Frame-Options", value: "DENY" },
                {
                  key: "Referrer-Policy",
                  value: "strict-origin-when-cross-origin",
                },
                {
                  key: "Permissions-Policy",
                  value: "camera=(), microphone=(), geolocation=()",
                },
              ],
            },
            {
              source: "/sw.js",
              headers: [
                {
                  key: "Cache-Control",
                  value: "no-cache, no-store, must-revalidate",
                },
                { key: "Service-Worker-Allowed", value: `${basePath}/` },
                {
                  key: "Content-Security-Policy",
                  value:
                    "default-src 'none'; script-src 'self'; connect-src 'self'",
                },
              ],
            },
          ];
        },
      }),
};

export default config;
