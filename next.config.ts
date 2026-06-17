import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Tree-shake barrel imports from these large UI packages so only the
    // components actually used ship to the browser. framer-motion in
    // particular is pulled in across nearly every page.
    optimizePackageImports: ["framer-motion", "geist"],
  },
};

export default nextConfig;
