import type { NextConfig } from "next";

const supabaseHostname = (() => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) return undefined;
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Bake the deployment mode into the server bundle so the root proxy can
  // reliably isolate the public store and the private admin application.
  // Vercel supplies NEXT_PUBLIC_APP_MODE at build time for each project.
  env: {
    NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE ?? process.env.APP_MODE,
  },
  ...(supabaseHostname ? {
    images: {
      remotePatterns: [{
        protocol: "https" as const,
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/**",
      }],
    },
  } : {}),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
