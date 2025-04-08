"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { NFTItem } from "@/types/contracts";
import { useCollections } from "@/hooks/useContracts";
import NFTCard from "@/components/nfts/NftCard";
import { getIPFSGatewayURL } from "@/services/ipfs";
import WavesBackground from "@/components/effects/WavesBackground";
import { CollectionCardSkeleton } from "@/components/ui/LoadingSkeleton";
import Link from "next/link";
import PepeButton from "@/components/ui/PepeButton";

export default function MyNFTsPage() {
  const { address } = useAccount();
  const { collections } = useCollections();
  const [myNFTs, setMyNFTs] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterForSale, setFilterForSale] = useState(false);

  useEffect(() => {
    const fetchUserNFTs = async () => {
      if (!address || collections.length === 0) {
        setMyNFTs([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const allNfts: NFTItem[] = [];

        // Fetch NFTs from each collection
        for (const collection of collections) {
          try {
            // Get token IDs for this collection
            const tokenIdsResponse = await fetch(
              `/api/contracts/userTokens?collection=${collection.address}&owner=${address}`
            );
            const { tokenIds } = await tokenIdsResponse.json();

            if (!tokenIds || tokenIds.length === 0) continue;

            // Fetch details for each token
            const nftsFromCollection = await Promise.all(
              tokenIds.map(async (tokenId: number) => {
                // Get token URI
                const tokenURIResponse = await fetch(
                  `/api/contracts/tokenURI?collection=${collection.address}&tokenId=${tokenId}`
                );
                const { tokenURI } = await tokenURIResponse.json();

                // Fetch metadata
                let metadata;
                try {
                  const metadataResponse = await fetch(
                    getIPFSGatewayURL(tokenURI)
                  );
                  metadata = await metadataResponse.json();
                } catch (err) {
                  console.error(
                    `Failed to fetch metadata for token ${tokenId}`,
                    err
                  );
                }

                // Get listing information
                let listing;
                try {
                  const listingResponse = await fetch(
                    `/api/contracts/tokenListing?collection=${collection.address}&tokenId=${tokenId}`
                  );
                  if (listingResponse.ok) {
                    const listingData = await listingResponse.json();
                    listing = listingData.listing;
                  }
                } catch (err) {
                  console.error(
                    `Failed to fetch listing for token ${tokenId}`,
                    err
                  );
                }

                return {
                  tokenId,
                  tokenURI,
                  owner: address,
                  collection: collection.address,
                  metadata,
                  listing,
                } as NFTItem;
              })
            );

            allNfts.push(...nftsFromCollection);
          } catch (err) {
            console.error(
              `Error fetching NFTs from collection ${collection.address}:`,
              err
            );
            // Continue with next collection
          }
        }

        setMyNFTs(allNfts);
      } catch (err) {
        console.error("Error fetching user NFTs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserNFTs();
  }, [address, collections]);

  // Group NFTs by collection
  const nftsByCollection = myNFTs.reduce((acc, nft) => {
    const collectionAddress = nft.collection;
    if (!acc[collectionAddress]) {
      acc[collectionAddress] = [];
    }
    acc[collectionAddress].push(nft);
    return acc;
  }, {} as Record<string, NFTItem[]>);

  // Filter NFTs if the "For Sale" filter is active
  const filteredNftsByCollection = Object.entries(nftsByCollection).reduce(
    (acc, [collectionAddress, nfts]) => {
      if (filterForSale) {
        const filteredNfts = nfts.filter(
          (nft) => nft.listing && nft.listing.active
        );
        if (filteredNfts.length > 0) {
          acc[collectionAddress] = filteredNfts;
        }
      } else {
        acc[collectionAddress] = nfts;
      }
      return acc;
    },
    {} as Record<string, NFTItem[]>
  );

  // Handle toggle for sale only
  const handleToggleForSale = () => {
    setFilterForSale(!filterForSale);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Banner */}
      <section className="w-full relative">
        <WavesBackground bubbleCount={8} />

        <div className="container mx-auto py-10 px-4 relative z-10">
          <motion.h1
            className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent text-center"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            My NFTs
          </motion.h1>
          <motion.p
            className="text-xl text-cyan-100 mb-6 text-center max-w-2xl mx-auto"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            View your valuable collection of NFTs from the BasedSea marketplace
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-8 z-10 flex-grow">
        {!address ? (
          <div className="bg-blue-900/30 rounded-xl p-8 text-center border border-blue-800/50 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Connect Your Wallet
            </h2>
            <p className="text-cyan-200 mb-6">
              Connect your wallet to view your NFTs
            </p>
            <PepeButton
              variant="primary"
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700"
            >
              Connect Wallet
            </PepeButton>
          </div>
        ) : loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, index) => (
                <CollectionCardSkeleton key={index} />
              ))}
            </div>
          </div>
        ) : myNFTs.length === 0 ? (
          <div className="bg-blue-900/30 rounded-xl p-8 text-center border border-blue-800/50 backdrop-blur-sm">
            <img
              src="/images/empty-collections.svg"
              alt="No NFTs found"
              className="w-64 h-auto mx-auto mb-6"
            />
            <h2 className="text-xl font-semibold mb-4 text-white">
              No NFTs Found
            </h2>
            <p className="text-cyan-200 mb-6">
              You don&apos;t own any NFTs yet. Explore collections and mint
              some!
            </p>
            <Link href="/collections">
              <PepeButton
                variant="primary"
                className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700"
              >
                Explore Collections
              </PepeButton>
            </Link>
          </div>
        ) : (
          <>
            {/* Filter Controls */}
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterForSale}
                    onChange={handleToggleForSale}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-2 text-sm font-medium text-slate-300">
                    For sale only
                  </span>
                </label>
              </div>
            </div>

            {Object.entries(filteredNftsByCollection).map(
              ([collectionAddress, nfts]) => {
                const collection = collections.find(
                  (c) => c.address === collectionAddress
                );

                return (
                  <div key={collectionAddress} className="mb-12">
                    <Link href={`/collections/${collectionAddress}`}>
                      <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent hover:from-blue-100 hover:to-cyan-100 transition-colors">
                        {collection?.name ||
                          `Collection ${collectionAddress.slice(0, 6)}...`}
                      </h2>
                    </Link>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {nfts.map((nft) => (
                        <NFTCard
                          key={`${nft.collection}-${nft.tokenId}`}
                          nft={nft}
                          collectionAddress={nft.collection}
                        />
                      ))}
                    </div>
                  </div>
                );
              }
            )}

            {/* Show message when no NFTs match the filter */}
            {Object.keys(filteredNftsByCollection).length === 0 &&
              filterForSale && (
                <div className="bg-blue-900/30 rounded-xl p-8 text-center border border-blue-800/50 backdrop-blur-sm">
                  <h2 className="text-xl font-semibold mb-4 text-white">
                    No NFTs For Sale
                  </h2>
                  <p className="text-cyan-200 mb-6">
                    You don&apos;t have any NFTs listed for sale.
                  </p>
                  <PepeButton
                    variant="primary"
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-cyan-700"
                    onClick={handleToggleForSale}
                  >
                    Show All NFTs
                  </PepeButton>
                </div>
              )}
          </>
        )}
      </section>
    </main>
  );
}
