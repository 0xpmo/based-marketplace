import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Based NFT Viewer",
  description: "View your NFT collections created with Based Marketplace Tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 shadow-md">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <Link href="/" className="text-xl font-bold">
              Based NFT Viewer
            </Link>
            <nav>
              <ul className="flex space-x-4">
                <li>
                  <Link href="/" className="hover:underline">
                    Collections
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t p-4 mt-8 text-sm text-gray-500">
          <div className="max-w-7xl mx-auto">
            <p>© {new Date().getFullYear()} Based NFT Viewer</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
