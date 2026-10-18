import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Enable instrumentation.ts so harmless ECONNRESET/aborted errors are silenced
  instrumentationHook: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "bqnsiuotcufakdwnkmqs.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
