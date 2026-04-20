/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Pin Next's workspace root to the frontend/ directory so it doesn't
  // get confused by the top-level backend lockfile
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "www.coingecko.com" },
      { protocol: "https", hostname: "cryptopanic.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

module.exports = nextConfig;
