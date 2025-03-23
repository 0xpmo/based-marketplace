// frontend/src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ClientLayout from "@/components/ClientOnly";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BasedSea | Ocean-themed NFT Marketplace on Based AI Blockchain",
  description: "The premier NFT marketplace on the Based AI blockchain",
  icons: {
    icon: "/images/wave-icon.svg",
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
