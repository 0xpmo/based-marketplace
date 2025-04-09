"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Collection, NFTItem } from "@/types/contracts";
import PepeButton from "@/components/ui/PepeButton";
import NFTCard from "@/components/nfts/NftCard";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { useCollections, useCollectionNFTs } from "@/hooks/useContracts";
import MintNftModal from "@/components/nfts/MintNftModal";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { useTokenPrice } from "@/contexts/TokenPriceContext";

export default function CollectionDetailsPage() {
  const { address } = useParams();
  const { isConnected } = useAccount();
  const { collections } = useCollections();
  const { tokenUSDRate, calculateUSDPrice, formatNumberWithCommas } =
    useTokenPrice();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMintModal, setShowMintModal] = useState(false);
  const [sortOption, setSortOption] = useState("price-low-high");
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
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Use our custom hook with pagination support
  const collectionAddr = Array.isArray(address)
    ? address[0]
    : (address as string);
  const shouldPrioritizeSales = useMemo(() => {
    return (
      filterForSale ||
      sortOption === "price-low-high" ||
      sortOption === "price-high-low"
    );
  }, [filterForSale, sortOption]);
  const {
    nfts,
    loading: loadingNFTs,
    metadataLoading,
    error: fetchError,
    currentPage,
    totalPages,
    totalTokens,
    pageSize,
    nextPage,
    prevPage,
    goToPage,
    setPageSize,
    refresh: refreshNFTs,
    salesCount,
  } = useCollectionNFTs(collectionAddr, shouldPrioritizeSales);

  // Calculate floor price from NFTs with active listings
  const floorPrice = useMemo(() => {
    // Only calculate floor price when metadata loading is complete
    if (metadataLoading) return null;

    const activeListings = nfts
      .filter((nft) => nft.listing && nft.listing.active)
      .map((nft) => parseFloat(nft.listing!.price));

    if (activeListings.length === 0) return null;

    return Math.min(...activeListings);
  }, [nfts, metadataLoading]);

  // Format floor price for display
  const formattedFloorPrice = useMemo(() => {
    if (!floorPrice) return null;

    return formatNumberWithCommas(floorPrice);
  }, [floorPrice, formatNumberWithCommas]);

  // Calculate USD value of floor price using the token price context
  const floorPriceUsd = useMemo(() => {
    if (!floorPrice || !tokenUSDRate) return null;

    return calculateUSDPrice(floorPrice.toString());
  }, [floorPrice, tokenUSDRate, calculateUSDPrice]);

  console.log("collections", collections);

  // Find collection from all collections
  useEffect(() => {
    if (collections.length > 0) {
      const collectionData = collections.find(
        (c) => c.address.toLowerCase() === String(address).toLowerCase()
      );
      if (collectionData) {
        setCollection(collectionData);
        setLoading(false);
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

  // Create a stable reference for sort function to prevent jumpiness during loading
  const sortedAndFilteredNFTs = useMemo(() => {
    console.log(`Sorting ${nfts.length} NFTs by ${sortOption}`);

    // First create a copy to avoid mutating the original array
    let result = [...nfts];

    // Only use price-based sorting when metadata loading is complete
    // During loading, maintain stable order based on token ID
    if (metadataLoading) {
      // During loading, use simple token ID sorting for stability
      if (sortOption === "newest") {
        result.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
      } else {
        // Default to oldest first during loading for other sort options
        result.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
      }
    } else {
      // Full sorting with prices once metadata is loaded
      if (sortOption === "newest") {
        result.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
      } else if (sortOption === "oldest") {
        result.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
      } else if (sortOption === "price-high-low") {
        result.sort((a, b) => {
          // If either NFT doesn't have a price (no listing or metadata still loading),
          // use tokenId for stable sorting
          const priceA =
            a.listing && a.listing.active ? parseFloat(a.listing.price) : 0;
          const priceB =
            b.listing && b.listing.active ? parseFloat(b.listing.price) : 0;

          const priceDiff = priceB - priceA;
          // If prices are the same or both are 0, sort by tokenId for stability
          return priceDiff !== 0
            ? priceDiff
            : Number(a.tokenId) - Number(b.tokenId);
        });
      } else if (sortOption === "price-low-high") {
        result.sort((a, b) => {
          // For price-low-high, NFTs without a price should go at the end
          const priceA =
            a.listing && a.listing.active
              ? parseFloat(a.listing.price)
              : Infinity;
          const priceB =
            b.listing && b.listing.active
              ? parseFloat(b.listing.price)
              : Infinity;

          const priceDiff = priceA - priceB;
          // If prices are the same or both are Infinity, sort by tokenId for stability
          return priceDiff !== 0
            ? priceDiff
            : Number(a.tokenId) - Number(b.tokenId);
        });
      }
    }

    // Only filter for sale if the user explicitly requested it via checkbox
    // When prioritizeSales is true but filterForSale is false, we still show all NFTs
    // but with for-sale items at the top (handled by the hook)
    if (filterForSale) {
      result = result.filter((nft) => nft.listing && nft.listing.active);
    }

    return result;
  }, [nfts, sortOption, filterForSale, metadataLoading]);

  // Handle toggle for sale only
  const handleToggleForSale = () => {
    setFilterForSale(!filterForSale);
    // Force a refresh when toggling to ensure we get the right data
    if (currentPage !== 0) {
      // Reset to page 0 when toggling filter
      goToPage(0);
    } else {
      refreshNFTs();
    }
  };

  // Handle Sort Change
  const handleSortChange = (option: string) => {
    const wasPriceBased =
      sortOption === "price-low-high" || sortOption === "price-high-low";
    const isPriceBased =
      option === "price-low-high" || option === "price-high-low";

    setSortOption(option);

    // If switching between price-based and non-price-based sorting, refresh the data
    if (wasPriceBased !== isPriceBased) {
      if (currentPage !== 0) {
        goToPage(0);
      } else {
        refreshNFTs();
      }
    }
  };

  // Determine loading state
  const isLoadingContent = loading || loadingNFTs;

  // Copy function for addresses
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
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
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Banner Image */}
      <div className="w-full h-80 relative overflow-hidden">
        {isBannerLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-900">
            <div className="w-12 h-12 border-4 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <Image
          src={bannerImageUrl}
          alt={collection?.metadata?.name || "Collection banner"}
          fill
          className="object-cover"
          onLoad={() => setIsBannerLoading(false)}
          onError={() => {
            setBannerError(true);
            setBannerImageUrl("/images/ocean-banner.svg");
            setIsBannerLoading(false);
          }}
        />
      </div>

      {/* Collection Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 mb-16 relative z-10">
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Collection Image */}
              <div className="flex-shrink-0">
                <div className="relative w-32 h-32 sm:w-48 sm:h-48 rounded-xl overflow-hidden border-4 border-slate-800 shadow-lg">
                  {isCollectionImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-900">
                      <div className="w-8 h-8 border-4 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <Image
                    src={collectionImageUrl}
                    alt={collection?.metadata?.name || "Collection"}
                    fill
                    className="object-cover"
                    onLoad={() => setIsCollectionImageLoading(false)}
                    onError={() => {
                      setCollectionImageError(true);
                      setCollectionImageUrl(
                        "/images/placeholder-collection.svg"
                      );
                      setIsCollectionImageLoading(false);
                    }}
                  />
                </div>
              </div>

              {/* Collection Info */}
              <div className="flex-1">
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-slate-700 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-slate-700 rounded w-1/2 mb-3"></div>
                    <div className="h-4 bg-slate-700 rounded w-full mb-2"></div>
                    <div className="h-4 bg-slate-700 rounded w-5/6"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center mb-2">
                      <h1 className="text-3xl font-bold text-white">
                        {collection?.metadata?.name || "Unnamed Collection"}
                      </h1>
                      <div className="ml-3 flex items-center text-sm text-slate-400">
                        <span className="hidden sm:inline-block">
                          {collectionAddr.slice(0, 6)}...
                          {collectionAddr.slice(-4)}
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(collectionAddr, "contract")
                          }
                          className="ml-2 text-blue-400 hover:text-blue-300 focus:outline-none"
                          title="Copy contract address"
                        >
                          {copiedText === "contract" ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="text-sm text-slate-400 mb-4 flex items-center">
                      By{" "}
                      <span className="font-medium text-blue-400 mx-1">
                        {collection?.owner?.slice(0, 6)}...
                        {collection?.owner?.slice(-4)}
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(collection?.owner || "", "owner")
                        }
                        className="text-blue-400 hover:text-blue-300 focus:outline-none"
                        title="Copy owner address"
                      >
                        {copiedText === "owner" ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <p className="text-slate-300 mb-6 max-w-2xl">
                      {collection?.metadata?.description ||
                        "No description available"}
                    </p>

                    <div className="flex flex-wrap gap-4">
                      <div className="bg-slate-800 rounded-lg px-4 py-2">
                        <div className="text-sm text-slate-400">Supply</div>
                        <div className="font-bold">
                          {collection?.maxSupply || "?"}
                        </div>
                      </div>
                      {!!collection?.totalMinted ? (
                        <div className="bg-slate-800 rounded-lg px-4 py-2">
                          <div className="text-sm text-slate-400">Items</div>
                          <div className="font-bold">
                            {collection?.totalMinted || 0}
                          </div>
                        </div>
                      ) : (
                        <></>
                      )}

                      {/* Floor price box - show placeholder during loading */}
                      {metadataLoading ? (
                        <div className="bg-slate-800 rounded-lg px-4 py-2 border-l-2 border-blue-500">
                          <div className="text-sm text-slate-400">
                            Floor Price
                          </div>
                          <div className="font-bold h-6 w-24 bg-slate-700 animate-pulse rounded"></div>
                          <div className="text-xs text-blue-400 h-4 w-16 bg-slate-700 animate-pulse rounded mt-1"></div>
                        </div>
                      ) : floorPrice ? (
                        <div className="bg-slate-800 rounded-lg px-4 py-2 border-l-2 border-blue-500">
                          <div className="text-sm text-slate-400">
                            Floor Price
                          </div>
                          <div className="font-bold">
                            {formattedFloorPrice} BASED
                          </div>
                          {floorPriceUsd && (
                            <div className="text-xs text-blue-400">
                              ≈ ${floorPriceUsd}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-slate-800 rounded-lg px-4 py-2 border-l-2 border-gray-500">
                          <div className="text-sm text-slate-400">
                            Floor Price
                          </div>
                          <div className="font-bold">No listings</div>
                          <div className="text-xs text-gray-400">-</div>
                        </div>
                      )}

                      {isConnected && collection?.owner && (
                        <div className="ml-auto">
                          <PepeButton
                            onClick={() => setShowMintModal(true)}
                            variant="primary"
                            disabled={
                              Number(collection.totalMinted) >=
                              Number(collection.maxSupply)
                            }
                          >
                            {Number(collection.totalMinted) >=
                            Number(collection.maxSupply)
                              ? "Sold Out"
                              : "Mint NFT"}
                          </PepeButton>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* NFT Gallery Section */}
          <div className="border-t border-slate-800 p-6 sm:p-8">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between mb-8 gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Sort By */}
                <div className="relative">
                  <select
                    value={sortOption}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="appearance-none bg-slate-800 border border-slate-700 text-white py-2 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="price-high-low">Price: High to Low</option>
                    <option value="price-low-high">Price: Low to High</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white">
                    <svg
                      className="fill-current h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>

                {/* For Sale Toggle */}
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

              {/* Refresh Button */}
              <PepeButton
                onClick={refreshNFTs}
                variant="primary"
                disabled={loadingNFTs}
                className="self-start"
              >
                {loadingNFTs ? "Loading..." : "Refresh"}
              </PepeButton>
            </div>

            {/* Initial Loading State */}
            {isLoadingContent && nfts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-blue-300 font-medium">
                  Loading collection...
                </p>
              </div>
            ) : (
              <>
                {/* Metadata Loading Indicator */}
                {metadataLoading && (
                  <div className="bg-blue-900/30 border border-blue-800/50 rounded-lg p-4 mb-6 flex items-center">
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-3"></div>
                    <span className="text-blue-300">
                      Loading NFT metadata and images...
                    </span>
                  </div>
                )}

                {/* No NFTs Message */}
                {!loadingNFTs && nfts.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-slate-700 rounded-xl">
                    <div className="text-6xl mb-4">🧠</div>
                    <h3 className="text-xl font-bold text-slate-300 mb-2">
                      No NFTs Found
                    </h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                      This collection doesn&apos;t have any NFTs yet. If
                      you&apos;re the creator, you can mint some!
                    </p>
                    {isConnected && collection?.owner && (
                      <div className="mt-6">
                        <PepeButton
                          onClick={() => setShowMintModal(true)}
                          variant="primary"
                          disabled={
                            Number(collection.totalMinted) >=
                            Number(collection.maxSupply)
                          }
                        >
                          {Number(collection.totalMinted) >=
                          Number(collection.maxSupply)
                            ? "Sold Out"
                            : "Mint NFT"}
                        </PepeButton>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                      {sortedAndFilteredNFTs.map((nft, index) => (
                        <div key={`${collection.address}-${nft.tokenId}`}>
                          <Link
                            href={`/collections/${collection.address}/${nft.tokenId}`}
                          >
                            <NFTCard nft={nft} />
                          </Link>
                        </div>
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex flex-col sm:flex-row justify-between items-center mt-8 bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
                        <div className="flex items-center mb-4 sm:mb-0">
                          <span className="text-slate-400 mr-3">
                            Items per page:
                          </span>
                          <select
                            value={pageSize}
                            onChange={(e) =>
                              setPageSize(Number(e.target.value))
                            }
                            className="bg-slate-700 text-white rounded px-2 py-1 border border-slate-600"
                          >
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                          </select>
                        </div>

                        <div className="flex items-center">
                          <button
                            onClick={prevPage}
                            disabled={currentPage === 0}
                            className={`px-3 py-1 rounded-l-md border border-slate-600 ${
                              currentPage === 0
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                : "bg-slate-700 text-white hover:bg-slate-600"
                            }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>

                          <div className="px-4 py-1 bg-slate-800 border-t border-b border-slate-600 text-white text-sm">
                            Page {currentPage + 1} of {totalPages}
                          </div>

                          <button
                            onClick={nextPage}
                            disabled={currentPage >= totalPages - 1}
                            className={`px-3 py-1 rounded-r-md border border-slate-600 ${
                              currentPage >= totalPages - 1
                                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                : "bg-slate-700 text-white hover:bg-slate-600"
                            }`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* End of collection message - update to show current page info */}
                {nfts.length > 0 && (
                  <div className="text-center mt-8 mb-6 text-blue-300 bg-blue-900/20 py-4 rounded-lg border border-blue-800/30">
                    {totalPages > 1
                      ? `Showing page ${currentPage + 1} (${
                          sortedAndFilteredNFTs.length
                        } NFTs) of ${totalTokens} total NFTs`
                      : `Showing all ${sortedAndFilteredNFTs.length} NFTs in this collection`}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mint Modal */}
      {showMintModal && collection && (
        <MintNftModal
          collection={collection}
          onClose={() => setShowMintModal(false)}
        />
      )}
    </div>
  );
}
