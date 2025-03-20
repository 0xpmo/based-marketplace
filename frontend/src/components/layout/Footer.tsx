// frontend/src/components/layout/Footer.tsx
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo and description */}
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center">
              <div className="relative h-10 w-10 mr-2">
                <Image
                  src="/images/pepe-logo.png"
                  alt="Pepe NFT Marketplace"
                  width={40}
                  height={40}
                />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-pepe-300 to-pepe-500 bg-clip-text text-transparent">
                Pepe NFT Market
              </span>
            </Link>
            <p className="mt-4 text-sm text-gray-400">
              The premier NFT marketplace on the Based AI blockchain, featuring
              Pepe-themed digital collectibles.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-gray-200 tracking-wider uppercase">
              Marketplace
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/explore"
                  className="text-gray-400 hover:text-pepe-400"
                >
                  Explore
                </Link>
              </li>
              <li>
                <Link
                  href="/create"
                  className="text-gray-400 hover:text-pepe-400"
                >
                  Create
                </Link>
              </li>
              <li>
                <Link
                  href="/my-nfts"
                  className="text-gray-400 hover:text-pepe-400"
                >
                  My NFTs
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-gray-200 tracking-wider uppercase">
              Resources
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/faq" className="text-gray-400 hover:text-pepe-400">
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-gray-400 hover:text-pepe-400"
                >
                  About
                </Link>
              </li>
              <li>
                <a
                  href="https://basedai.blockchain"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-pepe-400"
                >
                  Based AI Blockchain
                </a>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-sm font-semibold text-gray-200 tracking-wider uppercase">
              Community
            </h3>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-pepe-400"
                >
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-pepe-400"
                >
                  Discord
                </a>
              </li>
              <li>
                <a
                  href="https://telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-pepe-400"
                >
                  Telegram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8 flex flex-col md:flex-row justify-between">
          <p className="text-base text-gray-400">
            &copy; {new Date().getFullYear()} Pepe NFT Marketplace. All rights
            reserved.
          </p>
          <div className="mt-4 md:mt-0 flex space-x-6">
            <Link href="/terms" className="text-gray-400 hover:text-pepe-400">
              Terms
            </Link>
            <Link href="/privacy" className="text-gray-400 hover:text-pepe-400">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
