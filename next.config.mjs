/** @type {import('next').NextConfig} */
const nextConfig = {
  // Site 100 % statique : aucun serveur, aucune base de données.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
