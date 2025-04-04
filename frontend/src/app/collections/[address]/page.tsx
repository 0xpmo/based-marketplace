"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Collection,
  ERC1155Collection,
  ERC1155Item,
  NFTItem,
} from "@/types/contracts";
import PepeButton from "@/components/ui/PepeButton";
import NFTCard from "@/components/nfts/NftCard";
import UnifiedNftCard from "@/components/nfts/UnifiedNFTCard";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { useCollectionNFTsPaginated } from "@/hooks/useCollectionNFTs";
import { useERC1155CollectionTokens } from "@/hooks/useERC1155Contracts";
import { useAllCollections } from "@/hooks/useAllContracts";
import MintNftModal from "@/components/nfts/MintNftModal";
import ERC1155MintModal from "@/components/nfts/ERC1155MintModal";
import { useAccount } from "wagmi";
import { useTokenPrice } from "@/contexts/TokenPriceContext";
import { formatNumberWithCommas } from "@/utils/formatting";
import { isERC1155Collection } from "@/utils/collectionTypeDetector";
import CollectionStatusBadge from "@/components/collections/CollectionStatusBadge";
import { useCollectionListings } from "@/hooks/useListings";
import { ethers } from "ethers";
import { useDeepCompareEffect } from "@/utils/deepComparison";
import { LOADING_MESSAGES } from "./[tokenId]/page";

export default function CollectionDetailsPage() {
  const params = useParams();
  const { isConnected } = useAccount();
  const { collections } = useAllCollections();
  const { tokenUSDRate, calculateUSDPrice } = useTokenPrice();
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
  const [displayNfts, setDisplayNfts] = useState<(NFTItem | ERC1155Item)[]>([]);
  const [loadingMessage, setLoadingMessage] = useState(
    () => LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]
  );
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20; // Match the value in the hook

  // Collection address normalization
  const collectionAddr = Array.isArray(params.address)
    ? params.address[0]
    : (params.address as string);

  // Check if the collection is an ERC1155 collection
  const isERC1155 = useMemo(
    () => isERC1155Collection(collection),
    [collection]
  );

  // Use our new paginated hook
  const {
    nfts: erc721Nfts,
    totalCount,
    totalPages,
    isLoading: loadingERC721NFTs,
    refresh: refreshERC721NFTs,
    currentPage,
  } = useCollectionNFTsPaginated(
    isERC1155 || !collection ? "" : collectionAddr,
    page,
    PAGE_SIZE
  );

  const {
    tokens: erc1155Tokens,
    loading: loadingERC1155Tokens,
    // metadataLoading: metadataLoadingERC1155,
    // error: fetchErrorERC1155,
    refresh: refreshERC1155Tokens,
  } = useERC1155CollectionTokens(collection && isERC1155 ? collectionAddr : "");

  // Unified NFTs array combining both types
  const nfts = useMemo(() => {
    return isERC1155 ? erc1155Tokens : erc721Nfts;
  }, [isERC1155, erc721Nfts, erc1155Tokens]);

  // Unified loading states
  const loadingNFTs = isERC1155 ? loadingERC1155Tokens : loadingERC721NFTs;
  const metadataLoading = isERC1155 ? loadingERC1155Tokens : loadingERC721NFTs;
  // const fetchError = isERC1155 ? fetchErrorERC1155 : fetchErrorERC721;

  // Use  hook instead of direct API calls
  const {
    floorListings,
    isLoading: isLoadingListings,
    refetch: refetchListings,
  } = useCollectionListings(collectionAddr);

  // Update the refresh function to use our hook
  const refreshNFTs = () => {
    if (isERC1155) {
      refreshERC1155Tokens();
    } else {
      refreshERC721NFTs();
    }
    // Use refetchListings from the hook
    refetchListings();
  };

  useDeepCompareEffect(() => {
    // Simple update logic: when NFTs change, update display NFTs with listings
    if (nfts.length > 0) {
      const updatedNfts = nfts.map((nft) => {
        const tokenId = nft.tokenId.toString();
        const listing = floorListings[tokenId];

        // If the NFT has a listing, add listing data
        if (listing) {
          return {
            ...nft, // This preserves metadata and all other properties
            listing: {
              price: ethers.formatEther(listing.price),
              seller: listing.seller,
              active: listing.status === "Active",
              quantity: listing.quantity,
            },
          };
        }

        // Otherwise return the NFT as-is (with metadata intact)
        return nft;
      });

      setDisplayNfts(updatedNfts);
    } else {
      // If there are no NFTs, clear the display
      setDisplayNfts([]);
    }
  }, [nfts, floorListings]); // Only depend on what we use directly

  // Calculate floor price from database listings
  const floorPrice = useMemo(() => {
    // Return null if we're still loading metadata or listings
    if (metadataLoading || isLoadingListings) return null;

    const activePrices = Object.values(floorListings).map((listing) =>
      parseFloat(ethers.formatEther(listing.price))
    );

    if (activePrices.length === 0) {
      // Fallback to using nfts with active listings
      const activeListings = nfts
        .filter((nft) => nft.listing && nft.listing.active)
        .map((nft) => parseFloat(nft.listing!.price));

      if (activeListings.length === 0) return null;
      return Math.min(...activeListings);
    }

    return Math.min(...activePrices);
  }, [nfts, metadataLoading, floorListings, isLoadingListings]);

  // Format floor price for display
  const formattedFloorPrice = useMemo(() => {
    if (!floorPrice) return null;
    return formatNumberWithCommas(floorPrice);
  }, [floorPrice]);

  // Calculate USD value of floor price using the token price context
  const floorPriceUsd = useMemo(() => {
    if (!floorPrice || !tokenUSDRate) return null;
    return calculateUSDPrice(floorPrice.toString());
  }, [floorPrice, tokenUSDRate, calculateUSDPrice]);

  // Find collection from all collections
  useDeepCompareEffect(() => {
    if (collections.length > 0) {
      const collectionData = collections.find(
        (c) => c.address.toLowerCase() === String(params.address).toLowerCase()
      );
      if (collectionData) {
        setCollection(collectionData);
      }
    }
  }, [collections, params.address]);

  useDeepCompareEffect(() => {
    if (collection?.metadata?.image && !collectionImageError) {
      try {
        const url = getIPFSGatewayURL(collection.metadata.image);

        // Only update URL and loading state if URL actually changed
        setCollectionImageUrl((prevUrl) => {
          if (prevUrl !== url) {
            setIsCollectionImageLoading(true);
            return url;
          }
          return prevUrl;
        });
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

  useDeepCompareEffect(() => {
    if (
      (collection?.metadata?.banner_image_url || collection?.metadata?.image) &&
      !bannerError
    ) {
      try {
        const url = getIPFSGatewayURL(
          collection.metadata?.banner_image_url || collection.metadata?.image
        );

        // Only update URL and loading state if URL actually changed
        setBannerImageUrl((prevUrl) => {
          if (prevUrl !== url) {
            setIsBannerLoading(true);
            return url;
          }
          return prevUrl;
        });
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
    collection?.metadata?.banner_image_url,
    collection?.metadata?.image,
    bannerError,
  ]);

  // Create a stable reference for sort function to prevent jumpiness during loading
  const sortedAndFilteredNFTs = useMemo(() => {
    // First create a copy to avoid mutating the original array
    let result = [...displayNfts];

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

    // Then apply the filter if needed
    if (filterForSale) {
      result = result.filter((nft) => nft.listing && nft.listing.active);
    }

    return result;
  }, [displayNfts, sortOption, filterForSale, metadataLoading]);

  useDeepCompareEffect(() => {
    // Only set loading to false when all data loading is complete
    if (
      !loadingNFTs &&
      !metadataLoading &&
      !isLoadingListings &&
      collections.length > 0 &&
      collection !== null
    ) {
      setLoading(false);
    }
  }, [loadingNFTs, metadataLoading, isLoadingListings, collections.length]);

  // Handle toggle for sale only
  const handleToggleForSale = () => {
    setFilterForSale(!filterForSale);
  };

  // Handle Sort Change
  const handleSortChange = (option: string) => {
    setSortOption(option);
  };

  // Determine loading state
  const isLoadingContent = loading || loadingNFTs;

  // Copy function for addresses
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Helper function to determine if minting is available
  const isMintingAvailable = () => {
    if (!collection) return false;

    // Check if contract is paused
    const isPaused = collection.paused || collection.mintingEnabled === false;

    // For ERC721, check if all tokens are minted
    if (!isERC1155) {
      return (
        !isPaused &&
        Number(collection.totalSupply) < Number(collection.maxSupply)
      );
    }

    // For ERC1155, check if any token is mintable
    // We consider ERC1155 collection mintable if the contract is not paused
    // More complex logic could check specific token types availability
    return !isPaused;
  };

  // Helper function to get mint button text
  const getMintButtonText = () => {
    if (!collection) return "Mint NFT";

    // If contract is paused
    if (collection.mintingEnabled === false) {
      return "Minting Disabled";
    }

    // For ERC721, check max supply
    if (
      !isERC1155 &&
      Number(collection.totalSupply) >= Number(collection.maxSupply)
    ) {
      return "Sold Out";
    }

    return "Mint NFT";
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
              {loadingMessage}
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
          className="object-cover object-center"
          style={{ objectPosition: "center 30%" }}
          onLoad={() => setIsBannerLoading(false)}
          onError={() => {
            setBannerError(true);
            setBannerImageUrl("/images/ocean-banner.svg");
            setIsBannerLoading(false);
          }}
        />
      </div>

      {/* Collection Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 mb-16 relative z-10">
        {/* <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 mb-16 relative z-10"> */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Collection Image */}
              <div className="flex-shrink-0">
                <div className="relative rounded-xl overflow-hidden border-4 border-slate-800 shadow-lg w-32 h-32 sm:w-48 sm:h-48">
                  {isCollectionImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-900">
                      <div className="w-8 h-8 border-4 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <Image
                    src={collectionImageUrl}
                    alt={collection?.metadata?.name || "Collection"}
                    fill
                    className="object-contain"
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
                      {isERC1155 && (
                        <span className="ml-3 bg-indigo-800 text-xs text-indigo-200 px-2 py-1 rounded font-medium">
                          ERC-1155
                        </span>
                      )}
                      <div className="ml-3">
                        {collection && (
                          <CollectionStatusBadge collection={collection} />
                        )}
                      </div>
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
                      {!isERC1155 && (
                        <div className="bg-slate-800 rounded-lg px-4 py-2">
                          <div className="text-sm text-slate-400">Supply</div>
                          <div className="font-bold">
                            {collection?.maxSupply || "?"}
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-800 rounded-lg px-4 py-2">
                        <div className="text-sm text-slate-400">Items</div>
                        <div className="font-bold">{nfts.length || 0}</div>
                      </div>

                      {/* For ERC1155, show available characters if they exist */}
                      {isERC1155 &&
                        (collection as ERC1155Collection).characters && (
                          <div className="bg-slate-800 rounded-lg px-4 py-2">
                            <div className="text-sm text-slate-400">
                              Characters
                            </div>
                            <div className="font-bold">
                              {(collection as ERC1155Collection).characters
                                ?.length || 0}
                            </div>
                          </div>
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

                      {isConnected && collection && (
                        <div className="ml-auto">
                          {isMintingAvailable() ? (
                            <PepeButton
                              onClick={() => setShowMintModal(true)}
                              variant="primary"
                              disabled={collection.mintingEnabled === false}
                            >
                              {getMintButtonText()}
                            </PepeButton>
                          ) : (
                            <PepeButton
                              variant="outline"
                              disabled={true}
                              className="opacity-70 cursor-not-allowed"
                            >
                              {getMintButtonText()}
                            </PepeButton>
                          )}
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
                    <div className="text-6xl mb-4">🐳</div>
                    <h3 className="text-xl font-bold text-slate-300 mb-2">
                      {collection.mintingEnabled === false
                        ? "Minting is Currently Paused"
                        : !isERC1155 &&
                          Number(collection.totalSupply) >=
                            Number(collection.maxSupply)
                        ? "Collection Sold Out"
                        : "No NFTs Found"}
                    </h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                      {collection.mintingEnabled === false
                        ? "The creator has temporarily paused minting for this collection."
                        : !isERC1155 &&
                          Number(collection.totalSupply) >=
                            Number(collection.maxSupply)
                        ? "All NFTs in this collection have been minted. Check the marketplace for listings."
                        : "This collection doesn't have any NFTs yet. Mint some!"}
                    </p>

                    {isConnected && collection && isMintingAvailable() && (
                      <div className="mt-6">
                        <PepeButton
                          onClick={() => setShowMintModal(true)}
                          variant="primary"
                        >
                          Mint NFT
                        </PepeButton>
                      </div>
                    )}

                    {/* If collection is sold out but has listed NFTs, show a button to filter for listed NFTs */}
                    {!isERC1155 &&
                      Number(collection.totalSupply) >=
                        Number(collection.maxSupply) &&
                      nfts.some((nft) => nft.listing && nft.listing.active) && (
                        <div className="mt-6">
                          <PepeButton
                            onClick={() => setFilterForSale(true)}
                            variant="outline"
                            className="border-blue-500 text-blue-300 hover:bg-blue-900/30"
                          >
                            View Listed NFTs
                          </PepeButton>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                    {sortedAndFilteredNFTs.map((nft) => (
                      <div key={`${collection.address}-${nft.tokenId}`}>
                        <UnifiedNftCard
                          item={nft}
                          collectionAddress={collection.address}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* End of collection message */}
                {nfts.length > 0 && (
                  <div className="py-8 flex flex-col items-center justify-center">
                    {currentPage < totalPages ? (
                      <div className="text-center">
                        <div className="mb-4">
                          <span className="text-blue-300">
                            Showing {nfts.length} of {totalCount} NFTs
                          </span>
                        </div>
                        <PepeButton
                          variant="outline"
                          className="border-blue-500 text-blue-300"
                          onClick={() =>
                            !loadingNFTs && setPage((prev) => prev + 1)
                          }
                          disabled={loadingNFTs}
                        >
                          {loadingNFTs ? (
                            <div className="flex items-center">
                              <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mr-2"></div>
                              Loading...
                            </div>
                          ) : (
                            "Load More"
                          )}
                        </PepeButton>
                      </div>
                    ) : (
                      <div className="text-center mt-8 mb-6 text-blue-300 bg-blue-900/20 py-4 px-4 rounded-lg border border-blue-800/30">
                        Showing all {nfts.length} NFTs in this collection
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mint Modal - Different types based on collection */}
      {showMintModal &&
        collection &&
        (isERC1155 ? (
          <ERC1155MintModal
            collection={collection as ERC1155Collection}
            onClose={() => setShowMintModal(false)}
            onSuccess={refreshNFTs}
          />
        ) : (
          <MintNftModal
            collection={collection}
            onClose={() => setShowMintModal(false)}
          />
        ))}
    </div>
  );
}
