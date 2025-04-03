// frontend/src/app/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAllCollections } from "@/hooks/useAllContracts";
import CollectionCard from "@/components/collections/CollectionCard";
import PepeButton from "@/components/ui/PepeButton";
import PepeConfetti from "@/components/effects/PepeConfetti";
import { useEffect, useState } from "react";
import { Collection } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";

export default function Home() {
  const { collections, loading } = useAllCollections();
  const [featuredCollection, setFeaturedCollection] =
    useState<Collection | null>(null);

  useEffect(() => {
    // if (collections.length > 0) {
    //   const featured = collections.reduce(
    //     (prev, current) =>
    //       current.totalMinted > prev.totalMinted ? current : prev,
    //     collections[0]
    //   );
    //   setFeaturedCollection(featured);
    // }
    if (collections.length > 0) {
      const kekTrumpsCollection = collections.find(
        (collection) =>
          collection.address === process.env.NEXT_PUBLIC_KEK_TRUMPS_ADDRESS
      );
      if (kekTrumpsCollection) {
        setFeaturedCollection(kekTrumpsCollection);
      } else {
        setFeaturedCollection(collections[0]);
      }
    }
  }, [collections]);

  const topCollections = collections.slice(0, 3);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      {/* Hero Section */}
      <section className="w-full relative">
        {/* Background waves */}
        <div className="absolute inset-0 overflow-hidden z-0">
          <svg
            className="absolute bottom-0 w-full"
            viewBox="0 0 1440 320"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#0c4a6e"
              fillOpacity="0.6"
              d="M0,288L48,272C96,256,192,224,288,197.3C384,171,480,149,576,165.3C672,181,768,235,864,250.7C960,267,1056,245,1152,224C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
            <path
              fill="#0369a1"
              fillOpacity="0.4"
              d="M0,160L48,181.3C96,203,192,245,288,261.3C384,277,480,267,576,229.3C672,192,768,128,864,117.3C960,107,1056,149,1152,181.3C1248,213,1344,235,1392,245.3L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>

          {/* Animated bubbles */}
          {[...Array(8)].map((_, i) => {
            const size = Math.floor(Math.random() * 40) + 10;
            const duration = Math.floor(Math.random() * 8) + 6;
            const delay = Math.random() * 2;
            const leftPos = Math.random() * 90;

            return (
              <motion.div
                key={i}
                className="absolute bottom-0 rounded-full bg-white/20 z-0"
                style={{
                  width: size,
                  height: size,
                  left: `${leftPos}%`,
                }}
                initial={{ y: 100, opacity: 0 }}
                animate={{
                  y: -500,
                  opacity: [0, 0.7, 0],
                }}
                transition={{
                  duration: duration,
                  repeat: Infinity,
                  delay: delay,
                  ease: "linear",
                }}
              />
            );
          })}
        </div>

        <div className="container mx-auto py-16 px-4 sm:py-24 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center">
            <div className="md:w-1/2 mb-8 md:mb-0">
              <motion.h1
                className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                BasedSea NFT Marketplace
              </motion.h1>
              <motion.p
                className="text-xl text-cyan-100 mb-8 max-w-xl"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                Discover, collect, and sell NFTs on the BasedAI blockchain.
              </motion.p>
              <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Link href="/collections">
                  <PepeButton
                    variant="primary"
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30"
                  >
                    Explore Collections
                  </PepeButton>
                </Link>
                {/* <Link href="/collections/create">
                  <PepeButton
                    variant="outline"
                    className="border-cyan-500 text-cyan-300 hover:bg-cyan-900/30"
                  >
                    Create Collection
                  </PepeButton>
                </Link> */}
              </motion.div>
            </div>
            <div className="md:w-1/2 relative">
              <Link
                href={
                  featuredCollection
                    ? `/collections/${featuredCollection.address}`
                    : "#"
                }
              >
                <motion.div
                  className="relative w-full aspect-square max-w-lg mx-auto cursor-pointer transform transition-transform hover:scale-[1.02]"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-cyan-400/20 rounded-2xl backdrop-blur-sm -rotate-6 scale-105"></div>
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-800/20 to-cyan-600/20 rounded-2xl backdrop-blur-sm rotate-3 scale-105"></div>
                  {featuredCollection?.metadata?.image ? (
                    <Image
                      src={getIPFSGatewayURL(featuredCollection.metadata.image)}
                      alt={featuredCollection?.name || "Featured Collection"}
                      fill
                      className="rounded-2xl object-cover shadow-2xl shadow-blue-900/50 z-10"
                      priority
                    />
                  ) : (
                    <div
                      className="absolute inset-0 rounded-2xl shadow-2xl shadow-blue-900/50 z-10 bg-blue-900"
                      style={{
                        backgroundImage: "url('/images/hero-nft.png')",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 via-transparent to-transparent rounded-2xl z-20"></div>
                  <div className="absolute bottom-4 left-4 right-4 z-30 bg-gradient-to-r from-blue-900/80 to-cyan-800/80 backdrop-blur-md p-4 rounded-xl border border-blue-700/50">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          {featuredCollection?.name || "Loading Collection..."}
                        </h3>
                        <p className="text-cyan-300">
                          {loading
                            ? "Loading..."
                            : featuredCollection
                            ? "Featured Collection"
                            : "No Collections Available"}
                        </p>
                      </div>
                      <div className="bg-blue-900/50 px-3 py-1 rounded-lg border border-blue-700/30 text-sm">
                        <span className="text-cyan-400">
                          {featuredCollection
                            ? `${featuredCollection.totalSupply} Items`
                            : "0 Items"}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Top Collections Section */}
      <section className="w-full bg-gradient-to-b from-blue-950 to-blue-900 py-16 px-4">
        <div className="container mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-white">Top Collections</h2>
            <Link
              href="/collections"
              className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View All <span className="ml-2">→</span>
            </Link>
          </div>

          {topCollections.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topCollections.map((collection) => (
                <CollectionCard
                  key={collection.address}
                  collection={collection}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-blue-900/30 border border-blue-800/50 rounded-xl shadow-inner shadow-blue-900/30">
              <p className="text-cyan-200 mb-4">No collections available yet</p>
              {/* <Link href="/collections/create">
                <PepeButton
                  variant="primary"
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 border-cyan-700"
                >
                  Create First Collection
                </PepeButton>
              </Link> */}
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      {/* <section className="w-full py-16 px-4 relative overflow-hidden bg-gradient-to-b from-blue-900 to-blue-950">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-white">
              Upcoming Features
            </h2>
            <p className="text-cyan-200 max-w-2xl mx-auto">
              Prepare for the next wave...
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <div className="text-3xl text-cyan-400">🖼️</div>,
                title: "Studio",
                description: "Create your own NFTs with our built-in studio",
              },
              {
                icon: <div className="text-3xl text-cyan-400">👛</div>,
                title: "Secure Wallet",
                description:
                  "Connect with multiple wallets for secure transactions on the BasedAI network",
              },
              {
                icon: <div className="text-3xl text-cyan-400">💰</div>,
                title: "Low Fees",
                description: "Enjoy minimal gas fees on the BasedAI network",
              },
              {
                icon: <div className="text-3xl text-cyan-400">💡</div>,
                title: "Easy to Use",
                description:
                  "Intuitive interface designed for both NFT beginners and experienced collectors",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="bg-gradient-to-br from-blue-800/40 to-blue-900/40 p-6 rounded-xl border border-blue-700/30 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-900/30 transition-all duration-300 group"
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="mb-4 p-3 inline-block rounded-lg bg-blue-800/50 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-cyan-600 transition-colors duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">
                  {feature.title}
                </h3>
                <p className="text-cyan-200">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section> */}

      {/* CTA Section */}
      <section className="w-full py-16 px-4 bg-gradient-to-b from-blue-950 to-blue-900">
        <div className="container mx-auto">
          <div className="relative overflow-hidden bg-gradient-to-r from-blue-800 to-cyan-900 rounded-2xl p-8 md:p-12 shadow-xl shadow-blue-900/50 border border-blue-700/50">
            <div className="absolute right-0 bottom-0 w-64 h-64 opacity-20">
              <PepeConfetti trigger={true} />
            </div>

            <div className="relative z-10 md:w-2/3">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
                Ready to dive in?
              </h2>
              <p className="text-cyan-200 mb-8 text-lg">
                Start creating and collecting unique NFTs on BasedSea today
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/collections">
                  <PepeButton
                    variant="primary"
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30"
                  >
                    Explore Collections
                  </PepeButton>
                </Link>
                <Link href="/my-nfts">
                  <PepeButton
                    variant="outline"
                    className="border-cyan-300 text-cyan-300 hover:bg-cyan-900/30"
                  >
                    View My NFTs
                  </PepeButton>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="flex gap-4 justify-center"
      >
        <a
          href="https://x.com/basedsea_xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <PepeButton
            variant="primary"
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30 p-3"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
            </svg>
          </PepeButton>
        </a>
        <a
          href="https://t.me/+61XecOgCg540MzQx"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <PepeButton
            variant="primary"
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30 p-3"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </PepeButton>
        </a>
      </motion.div> */}
    </main>
  );
}
