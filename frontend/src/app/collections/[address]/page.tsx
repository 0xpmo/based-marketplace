"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Collection, NFTItem } from "@/types/contracts";
import PepeButton from "@/components/ui/PepeButton";
import NFTCard from "@/components/nfts/NftCard";
import { getIPFSGatewayURL, fetchFromIPFS } from "@/services/ipfs";
import { useCollections } from "@/hooks/useContracts";
import MintNftModal from "@/components/nfts/MintNftModal";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";

export default function CollectionDetailsPage() {
  const { address } = useParams();
  const { isConnected } = useAccount();
  const { collections } = useCollections();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNFTs, setLoadingNFTs] = useState(true);
  const [showMintModal, setShowMintModal] = useState(false);
  const [sortOption, setSortOption] = useState("newest");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterForSale, setFilterForSale] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState<string>(
    "/images/ocean-banner.svg"
  );
  const [collectionImageUrl, setCollectionImageUrl] = useState<string>(
    "/images/placeholder-collection.svg"
  );
  const [bannerError, setBannerError] = useState(false);
  const [collectionImageError, setCollectionImageError] = useState(false);
  const [isBannerLoading, setIsBannerLoading] = useState(true);
  const [isCollectionImageLoading, setIsCollectionImageLoading] =
    useState(true);

  console.log("collections", collections);

  // Find collection from all collections
  useEffect(() => {
    if (collections.length > 0) {
      const collectionData = collections.find(
        (c) => c.address.toLowerCase() === String(address).toLowerCase()
      );
      if (collectionData) {
        setCollection(collectionData);
      }
    }
  }, [collections, address]);

  // Set collection image with error handling
  useEffect(() => {
    if (collection?.metadata?.image && !collectionImageError) {
      try {
        const url = getIPFSGatewayURL(collection.metadata.image);
        setCollectionImageUrl(url);
        setIsCollectionImageLoading(true);
      } catch (err) {
        console.error("Error parsing collection image URL:", err);
        setCollectionImageError(true);
        setCollectionImageUrl("/images/placeholder-collection.svg");
        setIsCollectionImageLoading(false);
      }
    } else {
      setCollectionImageUrl("/images/placeholder-collection.svg");
      setIsCollectionImageLoading(false);
    }
  }, [collection?.metadata?.image, collectionImageError]);

  // Set banner image with error handling
  useEffect(() => {
    if (
      (collection?.metadata?.banner_image || collection?.metadata?.image) &&
      !bannerError
    ) {
      try {
        const url = getIPFSGatewayURL(
          collection.metadata?.banner_image || collection.metadata?.image
        );
        setBannerImageUrl(url);
        setIsBannerLoading(true);
      } catch (err) {
        console.error("Error parsing banner image URL:", err);
        setBannerError(true);
        setBannerImageUrl("/images/ocean-banner.svg");
        setIsBannerLoading(false);
      }
    } else {
      setBannerImageUrl("/images/ocean-banner.svg");
      setIsBannerLoading(false);
    }
  }, [
    collection?.metadata?.banner_image,
    collection?.metadata?.image,
    bannerError,
  ]);

  // Fetch NFT data
  useEffect(() => {
    const fetchNFTs = async () => {
      setLoading(true);
      setFetchError(null);

      if (!address) {
        setNfts([]);
        setLoading(false);
        return;
      }

      try {
        setLoadingNFTs(true);
        // Try collectionTokens endpoint first (matches our API implementation)
        const response = await fetch(
          `/api/contracts/collectionTokens?collection=${address}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch NFTs: ${response.statusText}`);
        }

        const data = await response.json();

        // Check if we have token IDs
        if (data.tokenIds && Array.isArray(data.tokenIds)) {
          console.log("Token IDs:", data.tokenIds);
          // Fetch details for each token
          const promises = data.tokenIds.map(async (tokenId: number) => {
            try {
              const detailsResponse = await fetch(
                `/api/contracts/tokenDetails?collection=${address}&tokenId=${tokenId}`
              );

              if (!detailsResponse.ok) {
                console.error(`Error fetching details for token ${tokenId}`);
                return null;
              }

              const tokenData = await detailsResponse.json();
              console.log("Token Data:", tokenData);

              // Fetch metadata from IPFS if tokenURI exists
              if (tokenData.tokenURI) {
                try {
                  const metadata = await fetchFromIPFS(tokenData.tokenURI);
                  tokenData.metadata = metadata;
                } catch (err) {
                  console.error(
                    `Error fetching metadata for token ${tokenId}:`,
                    err
                  );
                  tokenData.metadata = null;
                }
              }

              // Check for listing status
              try {
                const listingResponse = await fetch(
                  `/api/contracts/tokenListing?collection=${address}&tokenId=${tokenId}`
                );

                if (listingResponse.ok) {
                  const listingData = await listingResponse.json();
                  tokenData.listing = listingData.listing;
                }
              } catch (err) {
                console.error(
                  `Error fetching listing for token ${tokenId}`,
                  err
                );
              }

              return tokenData;
            } catch (err) {
              console.error(`Error fetching token ${tokenId} details`, err);
              return null;
            }
          });

          const tokensData = await Promise.all(promises);
          setNfts(tokensData.filter(Boolean));
        } else {
          setNfts([]);
        }
      } catch (err) {
        console.error("Error fetching NFTs", err);
        setFetchError("Failed to load NFTs. Please try again later.");
      } finally {
        setLoading(false);
        setLoadingNFTs(false);
      }
    };

    fetchNFTs();
  }, [address]);

  // Sort NFTs based on selected option
  const sortedNFTs = [...nfts].sort((a, b) => {
    if (sortOption === "newest") {
      return Number(b.tokenId) - Number(a.tokenId);
    } else if (sortOption === "oldest") {
      return Number(a.tokenId) - Number(b.tokenId);
    } else if (sortOption === "price-high-low") {
      const priceA =
        a.listing && a.listing.active ? parseFloat(a.listing.price) : 0;
      const priceB =
        b.listing && b.listing.active ? parseFloat(b.listing.price) : 0;
      return priceB - priceA;
    } else if (sortOption === "price-low-high") {
      const priceA =
        a.listing && a.listing.active ? parseFloat(a.listing.price) : Infinity;
      const priceB =
        b.listing && b.listing.active ? parseFloat(b.listing.price) : Infinity;
      return priceA - priceB;
    }
    return 0;
  });

  // Filter NFTs - For Sale
  const filteredNFTs = filterForSale
    ? sortedNFTs.filter((nft) => nft.listing && nft.listing.active)
    : sortedNFTs;

  // Handle toggle for sale only
  const handleToggleForSale = () => {
    setFilterForSale(!filterForSale);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <div className="bg-black/50 backdrop-blur-md p-10 rounded-2xl max-w-md mx-auto border border-blue-500/30">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 relative">
              <div className="animate-ping absolute h-full w-full rounded-full bg-blue-500/30"></div>
              <div className="animate-spin h-16 w-16 border-4 border-blue-400 border-t-transparent rounded-full relative"></div>
            </div>
            <p className="text-xl font-medium text-blue-100">
              Diving into the collection...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="bg-card border border-blue-800/30 rounded-xl shadow-lg p-8 text-center max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-4 text-blue-100">
            Collection Not Found
          </h1>
          <p className="text-gray-400 mb-6">
            The collection you&apos;re looking for doesn&apos;t exist or has
            been removed.
          </p>
          <Link href="/collections">
            <PepeButton variant="primary">View All Collections</PepeButton>
          </Link>
        </div>
      </div>
    );
  }

  const mintedPercent =
    collection.totalMinted && collection.maxSupply
      ? (Number(collection.totalMinted) / Number(collection.maxSupply)) * 100
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-background">
      {/* Banner Image with Ocean Overlay */}
      <div className="w-full h-56 sm:h-64 md:h-72 lg:h-80 xl:h-96 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-950/90 z-10" />
        {isBannerLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-900/70 z-5">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <Image
          src={bannerImageUrl}
          alt={collection?.name || "Collection banner"}
          fill
          className="object-cover scale-105"
          priority
          onError={() => {
            setBannerError(true);
            setBannerImageUrl("/images/ocean-banner.svg");
            setIsBannerLoading(false);
          }}
          onLoad={() => setIsBannerLoading(false)}
        />
        <div className="absolute inset-0 bg-blue-950/30 z-5" />

        {/* Animated Wave Effect */}
        {/* <div className="absolute bottom-0 left-0 right-0 h-16 z-20 overflow-hidden">
          <svg
            className="absolute bottom-0 w-full h-20"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path
              d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
              fill="#0f172a"
              opacity=".25"
              className="animate-[wave_15s_ease-in-out_infinite]"
            ></path>
            <path
              d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
              fill="#0f172a"
              opacity=".5"
              className="animate-[wave_10s_ease-in-out_infinite_reverse]"
            ></path>
            <path
              d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"
              fill="#0f172a"
              className="animate-[wave_7s_ease-in-out_infinite]"
            ></path>
          </svg>
        </div> */}
      </div>

      <div className="container mx-auto px-4 -mt-20 sm:-mt-24 md:-mt-28 relative z-30">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row gap-8 items-start"
        >
          {/* Collection Image */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="relative w-40 h-40 md:w-48 md:h-48 rounded-2xl overflow-hidden border-4 border-blue-900 shadow-2xl shadow-blue-900/50"
          >
            {isCollectionImageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-blue-900/70 z-10">
                <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <Image
              src={collectionImageUrl}
              alt={collection?.name || "Collection"}
              fill
              className="object-cover"
              priority
              onError={() => {
                setCollectionImageError(true);
                setCollectionImageUrl("/images/placeholder-collection.svg");
                setIsCollectionImageLoading(false);
              }}
              onLoad={() => setIsCollectionImageLoading(false)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 to-transparent"></div>
          </motion.div>

          {/* Collection Info */}
          <div className="flex-1">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h1 className="text-3xl md:text-4xl font-bold mb-2 text-white drop-shadow-md">
                {collection.name}
              </h1>
              <div className="text-sm text-blue-200 flex items-center mb-4">
                <span className="font-mono bg-blue-900/40 px-2 py-1 rounded-md border border-blue-800/50">
                  {collection.address.substring(0, 6)}...
                  {collection.address.substring(collection.address.length - 4)}
                </span>
                <button
                  className="ml-2 text-blue-300 hover:text-blue-100 transition-colors"
                  onClick={() =>
                    navigator.clipboard.writeText(collection.address)
                  }
                >
                  {/* <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2M8 5a2 2 0 002-2h2a2 2 0 012 2M8 5a2 2 0 002 2h6a2 2 0 012-2M8 9h6v12H8z"
                    />
                  </svg> */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-6 max-w-2xl"
            >
              <p className="text-blue-100 mb-4 leading-relaxed">
                {collection.metadata?.description ||
                  "No description available."}
              </p>

              {/* Mint Progress */}
              <div className="bg-blue-900/30 border border-blue-700/30 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                <div className="flex justify-between mb-2 text-blue-100">
                  <span>Total Minted</span>
                  <span className="font-medium">
                    {collection.totalMinted} / {collection.maxSupply}
                  </span>
                </div>
                <div className="w-full bg-blue-950 rounded-full h-3 mb-1 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-cyan-400 h-3 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(mintedPercent, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-right text-blue-300">
                  {mintedPercent.toFixed(1)}% minted
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-4"
            >
              {/* Mint Button - Always shown but conditionally disabled */}
              {isConnected ? (
                <div className="relative">
                  <PepeButton
                    variant="primary"
                    onClick={() => setShowMintModal(true)}
                    className="relative overflow-hidden group bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={
                      !collection.mintingEnabled ||
                      Number(collection.totalMinted) >=
                        Number(collection.maxSupply)
                    }
                    aria-label={
                      !collection.mintingEnabled
                        ? "Minting is not live yet"
                        : "Mint NFT"
                    }
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/30 to-blue-400/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                    {Number(collection.totalMinted) >=
                    Number(collection.maxSupply)
                      ? "Sold Out"
                      : !collection.mintingEnabled
                      ? "Minting Not Live"
                      : "Mint NFT"}
                  </PepeButton>
                </div>
              ) : (
                <div className="relative">
                  <PepeButton
                    variant="primary"
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                    disabled={!collection.mintingEnabled}
                    aria-label={
                      !collection.mintingEnabled
                        ? "Minting is not live yet"
                        : "Connect Wallet to Mint"
                    }
                    onClick={() => {
                      // This will trigger the wallet connection dialog through the header button
                      const connectBtn = document.querySelector(
                        "[data-wallet-connect]"
                      );
                      if (connectBtn instanceof HTMLElement) {
                        connectBtn.click();
                      }
                    }}
                  >
                    {!collection.mintingEnabled
                      ? "Minting Not Live"
                      : "Connect Wallet to Mint"}
                  </PepeButton>
                </div>
              )}

              <Link
                href={`https://explorer.bf1337.org/address/${collection.address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <PepeButton
                  variant="outline"
                  className="border-blue-500 text-blue-300 hover:bg-blue-900/30"
                >
                  <span className="flex items-center">
                    View on Explorer
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 ml-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </span>
                </PepeButton>
              </Link>
            </motion.div>
          </div>
        </motion.div>

        {/* NFT Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-white">
              Collection Items ({nfts.length})
            </h2>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              {/* Filter */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filterForSale}
                      onChange={handleToggleForSale}
                    />
                    <div
                      className={`block w-10 h-6 rounded-full transition ${
                        filterForSale ? "bg-blue-500" : "bg-gray-700"
                      }`}
                    ></div>
                    <div
                      className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${
                        filterForSale ? "translate-x-4" : ""
                      }`}
                    ></div>
                  </div>
                  <span className="ml-3 text-sm text-blue-100">
                    For Sale Only
                  </span>
                </label>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="bg-blue-900/30 border border-blue-700/30 rounded-lg px-4 py-2 text-sm text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price-high-low">Price: High to Low</option>
                <option value="price-low-high">Price: Low to High</option>
              </select>
            </div>
          </div>

          {loadingNFTs ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 min-h-[200px] place-items-center">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-blue-900/20 border border-blue-800/30 rounded-xl overflow-hidden shadow-lg w-full aspect-square animate-pulse"
                >
                  <div className="bg-blue-950/50 h-full w-full"></div>
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="bg-card border border-red-800/30 rounded-xl p-8 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 mx-auto text-red-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-xl font-medium mb-2 text-red-300">
                Error Loading NFTs
              </h3>
              <p className="text-gray-400 mb-6">{fetchError}</p>
              <PepeButton
                variant="primary"
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => window.location.reload()}
              >
                Try Again
              </PepeButton>
            </div>
          ) : filteredNFTs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredNFTs.map((nft) => (
                <div key={`${collection.address}-${nft.tokenId}`}>
                  <Link
                    href={`/collections/${collection.address}/${nft.tokenId}`}
                  >
                    <NFTCard nft={nft} collectionAddress={collection.address} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-8 text-center backdrop-blur-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 mx-auto text-blue-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-xl font-medium mb-2 text-blue-100">
                No NFTs Found
              </h3>
              <p className="text-blue-200 mb-6">
                {filterForSale
                  ? "There are no NFTs listed for sale in this collection yet."
                  : "This collection doesn't have any NFTs yet."}
              </p>
              {filterForSale && (
                <PepeButton
                  variant="outline"
                  className="border-blue-500 text-blue-300 hover:bg-blue-900/30"
                  onClick={handleToggleForSale}
                >
                  Show All NFTs
                </PepeButton>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Mint Modal */}
      {showMintModal && (
        <MintNftModal
          collection={collection}
          onClose={() => setShowMintModal(false)}
        />
      )}
    </div>
  );
}
