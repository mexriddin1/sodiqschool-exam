/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output so PM2 can serve the built site with a single node
  // process (mirrors the admin app deployment).
  output: "standalone",
};

export default nextConfig;
