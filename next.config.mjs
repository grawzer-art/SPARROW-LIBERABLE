/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pages pré-générées (statiques) + une petite route d'API pour les photos des témoins.
  images: { unoptimized: true },
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
