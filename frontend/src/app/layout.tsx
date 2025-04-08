// frontend/src/app/layout.tsx
import ClientLayout from "@/components/ClientLayout";
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BasedSea | NFT Marketplace on BasedAI",
  description: "The most based NFT marketplace on the Based AI blockchain",
  icons: {
    // icon: "/images/wave-icon.svg",
    icon: "/images/whale-logo.jpg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
