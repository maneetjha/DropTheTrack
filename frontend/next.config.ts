import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep LAN-device dev sessions stable (iPhone/Android over local IP).
  allowedDevOrigins: [
    "localhost",
    "192.168.1.30",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "*.ytimg.com",
      },
      // Local backend uploads (dev)
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
    ],
  },
  devIndicators: false
};

export default nextConfig;
