import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});
// Police du logotype et des titres de marque (sous-ensemble latin, graisses 600 à 700).
const sora = localFont({
  src: "./fonts/SoraVF-latin.woff2",
  variable: "--font-sora",
  weight: "600 700",
});

export const metadata: Metadata = {
  title: { default: "Avoo", template: "%s · Avoo" },
  description: "Trouvez un livreur pour vos colis à Libreville, Akanda et Owendo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} min-h-dvh`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
