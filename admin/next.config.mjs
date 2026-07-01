/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile the workspace @sodiq/compute package. Only its /compute and
  // /composite subpaths are imported (no node:crypto).
  transpilePackages: ["@sodiq/compute"],
};

export default nextConfig;
