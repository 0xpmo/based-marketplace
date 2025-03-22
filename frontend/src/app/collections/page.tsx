"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCollections } from "@/hooks/useContracts";
import CollectionCard from "@/components/collections/CollectionCard";
import PepeButton from "@/components/ui/PepeButton";
import { CollectionCardSkeleton } from "@/components/ui/LoadingSkeleton";
import WavesBackground from "@/components/effects/WavesBackground";

export default function CollectionsPage() {
  const { collections, loading, error, refreshCollections } = useCollections();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("newest");

  // Filter collections based on search term
  const filteredCollections = collections.filter(
    (collection) =>
      collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.metadata?.description
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  // Sort collections based on selected option
  const sortedCollections = [...filteredCollections].sort((a, b) => {
    switch (sortOption) {
      case "newest":
        // This is a placeholder as we don't have creation timestamps
        // In a real app, you'd sort by creation date
        return 0;
      case "minted":
        return b.totalMinted - a.totalMinted;
      case "az":
        return a.name.localeCompare(b.name);
      case "za":
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Banner */}
      <section className="w-full relative">
        {/* Ocean Background with Waves */}
        <WavesBackground bubbleCount={12} />

        <div className="container mx-auto py-12 px-4 relative z-10">
          <motion.h1
            className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent text-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            Explore Collections
          </motion.h1>
          <motion.p
            className="text-xl text-cyan-100 mb-8 text-center max-w-3xl mx-auto"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Discover incredible digital collections from creators around the
            world
          </motion.p>
        </div>
      </section>

      {/* Collections Content */}
      <section className="container mx-auto py-8 px-4 z-10 flex-grow">
        {/* Search and Filters */}
        <div className="bg-blue-900/30 rounded-xl p-4 mb-8 border border-blue-800/50 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-blue-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search collections..."
                className="pl-10 pr-4 py-2 w-full bg-blue-950/50 text-white rounded-lg border border-blue-700/50 focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-cyan-300 whitespace-nowrap">
                Sort by:
              </label>
              <select
                id="sort"
                className="bg-blue-950/50 text-white rounded-lg border border-blue-700/50 p-2 focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="newest">Newest</option>
                <option value="minted">Most Minted</option>
                <option value="az">A-Z</option>
                <option value="za">Z-A</option>
              </select>

              <button
                onClick={refreshCollections}
                className="ml-2 p-2 text-cyan-300 hover:text-cyan-100 bg-blue-950/50 rounded-lg border border-blue-700/50 hover:border-blue-500 transition-colors"
                title="Refresh collections"
                aria-label="Refresh collections"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7.805V10a1 1 0 01-2 0V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H16a1 1 0 110 2h-5a1 1 0 01-1-1v-5a1 1 0 112 0v1.938a7.001 7.001 0 01-8.717-4.967 1 1 0 01.725-1.214z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <Link href="/collections/create">
              <PepeButton
                variant="primary"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30 whitespace-nowrap"
              >
                Create Collection
              </PepeButton>
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <CollectionCardSkeleton key={index} />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-10 bg-red-900/30 border border-red-800/50 rounded-xl mb-8">
            <p className="text-red-300 mb-4">Error loading collections</p>
            <PepeButton
              variant="secondary"
              className="bg-red-700 border-red-600 hover:bg-red-800"
              onClick={refreshCollections}
            >
              Try Again
            </PepeButton>
          </div>
        )}

        {/* No Collections State */}
        {!loading && !error && sortedCollections.length === 0 && (
          <div className="text-center py-16 bg-blue-900/30 border border-blue-800/50 rounded-xl mb-8">
            {searchTerm ? (
              <>
                <img
                  src="/images/no-search-results.svg"
                  alt="No search results found"
                  className="w-64 h-auto mx-auto mb-6"
                />
                <p className="text-cyan-200 mb-4">
                  No collections found matching &quot;{searchTerm}&quot;
                </p>
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <img
                  src="/images/empty-collections.svg"
                  alt="No collections found"
                  className="w-64 h-auto mx-auto mb-6"
                />
                <p className="text-cyan-200 mb-4">
                  No collections available yet
                </p>
                <Link href="/collections/create">
                  <PepeButton
                    variant="primary"
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 border-cyan-700"
                  >
                    Create First Collection
                  </PepeButton>
                </Link>
              </>
            )}
          </div>
        )}

        {/* Collections Grid */}
        {!loading && !error && sortedCollections.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sortedCollections.map((collection) => (
              <CollectionCard
                key={collection.address}
                collection={collection}
              />
            ))}
          </div>
        )}
      </section>

      {/* Create Collection CTA */}
      {!loading && !error && sortedCollections.length > 0 && (
        <section className="w-full py-16 bg-gradient-to-b from-blue-950 to-blue-900 mt-12">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-4 text-white">
              Ready to create your own collection?
            </h2>
            <p className="text-cyan-200 mb-6 max-w-2xl mx-auto">
              Launch your NFT collection on BasedSea with low gas fees and
              powerful tools for creators
            </p>
            <Link href="/collections/create">
              <PepeButton
                variant="primary"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700 shadow-lg shadow-blue-900/30"
              >
                Create Collection
              </PepeButton>
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
