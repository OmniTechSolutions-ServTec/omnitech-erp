import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OmniTech Solutions | La Paz y El Alto",
  description: "Servicio Técnico, Mantenimiento y Soporte IT Premium con cobertura exclusiva en La Paz y El Alto, Bolivia.",
  manifest: "/manifest.json",
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-BO">
      <body className={inter.className}>{children}</body>
    </html>
  );
}