import type { Metadata, Viewport } from "next";
import "@fontsource/anton/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-700.css";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";
import { APP_NAME, SHORT_NAME } from "@/config";

const description = "Dossier classifié SP-2031. Compte à rebours officiel (et totalement fictif) jusqu'au 12 octobre 2031.";

export const metadata: Metadata = {
  metadataBase: process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    : undefined,
  title: APP_NAME,
  description,
  applicationName: SHORT_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SHORT_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: APP_NAME,
    description,
    type: "website",
    locale: "fr_FR",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: { card: "summary_large_image", title: APP_NAME, description, images: ["/og.png"] },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#090909",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}.intro{display:none!important}`}</style>
        </noscript>
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
