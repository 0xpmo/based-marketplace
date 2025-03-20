// frontend/src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCollections } from "@/hooks/useContracts";
import CollectionCard from "@/components/collections/CollectionCard";
import PepeButton from "@/components/ui/PepeButton";
import PepeConfetti from "@/components/effects/PepeConfetti";

export default function Home() {
  const { collections, loading } = useCollections();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Show confetti animation after a short delay for fun
    const timer = setTimeout(() => setShowConfetti(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
      },
    }),
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PepeConfetti trigger={showConfetti} />

      {/* Hero section */}
      <section className="relative w-full bg-pepe-pattern pt-12 pb-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 to-background/70 backdrop-blur-sm" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center md:text-left"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                <span className="bg-gradient-to-r from-pepe-300 to-pepe-500 bg-clip-text text-transparent">
                  Pepe NFT Marketplace
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-300 mb-8">
                Discover, collect, and trade unique Pepe NFTs on the Based AI
                blockchain. Join the most exciting NFT marketplace in the crypto
                space!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Link href="/explore">
                  <PepeButton variant="primary" size="lg">
                    Explore Collections
                  </PepeButton>
                </Link>
                <Link href="/create">
                  <PepeButton variant="outline" size="lg">
                    Create Collection
                  </PepeButton>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="hidden md:block relative h-80 w-full"
            >
              <Image
                src="/images/pepe-hero.png"
                alt="Pepe NFT Showcase"
                fill
                className="object-contain"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Top collections section */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">Top Collections</h2>
            <Link href="/explore">
              <PepeButton variant="ghost">View All</PepeButton>
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pepe-500" />
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold mb-4">No collections yet</h3>
              <p className="text-gray-400 mb-6">
                Be the first to create a collection!
              </p>
              <Link href="/create">
                <PepeButton variant="primary">Create Collection</PepeButton>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.slice(0, 6).map((collection, index) => (
                <motion.div
                  key={collection.address}
                  custom={index}
                  initial="hidden"
                  animate="visible"
                  variants={fadeIn}
                >
                  <CollectionCard collection={collection} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Features section */}
      <section className="py-16 px-4 bg-card">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Why Choose Pepe NFT Marketplace
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              whileHover={{ y: -5 }}
              className="bg-background p-6 rounded-lg shadow-lg border border-border"
            >
              <div className="h-12 w-12 bg-pepe-500/20 flex items-center justify-center rounded-lg mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-pepe-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Fast & Low Fees</h3>
              <p className="text-gray-400">
                Experience lightning-fast transactions and minimal fees on the
                Based AI blockchain.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="bg-background p-6 rounded-lg shadow-lg border border-border"
            >
              <div className="h-12 w-12 bg-pepe-500/20 flex items-center justify-center rounded-lg mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-pepe-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Ownership</h3>
              <p className="text-gray-400">
                Your NFTs are securely stored on the blockchain with verifiable
                ownership.
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="bg-background p-6 rounded-lg shadow-lg border border-border"
            >
              <div className="h-12 w-12 bg-pepe-500/20 flex items-center justify-center rounded-lg mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-pepe-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Creator Royalties</h3>
              <p className="text-gray-400">
                Creators earn royalties on secondary sales, supporting the Pepe
                artist community.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 px-4 bg-gradient-to-r from-pepe-900/80 to-pepe-700/80">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to hop into the NFT revolution?
          </h2>
          <p className="text-lg text-gray-200 mb-8 max-w-2xl mx-auto">
            Join thousands of collectors and creators on the Based AI
            blockchain&apos;s premier Pepe-themed NFT marketplace.
          </p>
          <Link href="/explore">
            <PepeButton variant="primary" size="lg">
              Get Started Now
            </PepeButton>
          </Link>
        </div>
      </section>
    </div>
  );
}
