/** @type {import('next').NextConfig} */
const nextConfig = {
  // No ESLint in this project; type checking runs through `npm run typecheck`.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["unpdf", "pdf-lib"],
  },
};

export default nextConfig;
