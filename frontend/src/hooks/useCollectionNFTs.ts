import { useCallback, useEffect, useState } from "react";
import { NFTItem } from "@/types/contracts";
import { getActiveChain } from "@/config/chains";
import { createPublicClient, http } from "viem";
import { fetchFromIPFS } from "@/services/ipfs";
import useSWR from "swr";
import { useAccount } from "wagmi";
import MarketplaceABI from "@/contracts/BasedSeaMarketplace.json";
import { MARKETPLACE_ADDRESS } from "@/constants/addresses";

// Page size for NFT data pagination
const PAGE_SIZE = 20;

// Cache storage
interface NFTCache {
  [key: string]: {
    data: NFTItem[];
    timestamp: number;
    totalCount: number;
  };
}
const nftCache: NFTCache = {};
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// SWR fetcher for NFTs with pagination
async function fetchCollectionNFTs(
  key: string
): Promise<{ nfts: NFTItem[]; totalCount: number }> {
  const [collectionAddress, page, pageSize] = key.split(":");
  const pageNum = parseInt(page);
  const pageSizeNum = parseInt(pageSize);

  if (!collectionAddress) {
    return { nfts: [], totalCount: 0 };
  }

  const cacheKey = `${collectionAddress}:${pageNum}:${pageSizeNum}`;
  const cachedData = nftCache[cacheKey];

  // Return cached data if it's still valid
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_EXPIRY) {
    console.log("Returning cached NFT data");
    return { nfts: cachedData.data, totalCount: cachedData.totalCount };
  }

  try {
    const publicClient = createPublicClient({
      chain: getActiveChain(),
      transport: http(),
    });

    // First get total supply to know pagination bounds
    const totalSupply = await publicClient.readContract({
      address: collectionAddress as `0x${string}`,
      abi: [
        {
          inputs: [],
          name: "totalSupply",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "totalSupply",
    });

    const totalCount = Number(totalSupply);

    // Calculate start and end points for this page
    const start = (pageNum - 1) * pageSizeNum;
    const end = Math.min(start + pageSizeNum, totalCount);

    // Batch promise for token IDs in this page range
    const tokenPromises = [];
    for (let i = start; i < end; i++) {
      tokenPromises.push(
        publicClient.readContract({
          address: collectionAddress as `0x${string}`,
          abi: [
            {
              inputs: [
                { internalType: "uint256", name: "index", type: "uint256" },
              ],
              name: "tokenByIndex",
              outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ],
          functionName: "tokenByIndex",
          args: [BigInt(i)],
        })
      );
    }

    const tokenIds = await Promise.all(tokenPromises);

    // Batch token URI requests
    const uriPromises = tokenIds.map((tokenId) =>
      publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: [
          {
            inputs: [
              { internalType: "uint256", name: "tokenId", type: "uint256" },
            ],
            name: "tokenURI",
            outputs: [{ internalType: "string", name: "", type: "string" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "tokenURI",
        args: [BigInt(tokenId.toString())],
      })
    );

    const tokenURIs = await Promise.all(uriPromises);

    // Create initial NFT items without metadata (will be fetched in background)
    const nfts: NFTItem[] = tokenIds.map((tokenId, index) => ({
      tokenId: Number(tokenId),
      owner: "", // Will be filled in background
      tokenURI: tokenURIs[index] as string,
      collection: collectionAddress,
      metadata: undefined,
      listing: undefined,
    }));

    // Store in cache
    nftCache[cacheKey] = {
      data: nfts,
      timestamp: Date.now(),
      totalCount,
    };

    // Start background fetching of metadata and owner info
    fetchMetadataAndOwnersInBackground(nfts, publicClient, collectionAddress);

    return { nfts, totalCount };
  } catch (error) {
    console.error("Error fetching collection NFTs:", error);
    return { nfts: [], totalCount: 0 };
  }
}

// Background fetcher for additional NFT data
async function fetchMetadataAndOwnersInBackground(
  nfts: NFTItem[],
  publicClient: any,
  collectionAddress: string
) {
  try {
    // Batch owner requests
    const ownerPromises = nfts.map((nft) =>
      publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: [
          {
            inputs: [
              { internalType: "uint256", name: "tokenId", type: "uint256" },
            ],
            name: "ownerOf",
            outputs: [{ internalType: "address", name: "", type: "address" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "ownerOf",
        args: [BigInt(nft.tokenId)],
      })
    );

    // Get marketplace listings in one call if possible
    const listingsMap: Record<string, any> = {};
    try {
      // Check if the correct function exists in the ABI
      const hasGetCollectionListings = MarketplaceABI.abi.some(
        (item: any) =>
          item.name === "getCollectionListings" && item.type === "function"
      );

      // Use the correct function name or fall back to an empty result
      if (hasGetCollectionListings) {
        const result = await publicClient.readContract({
          address: MARKETPLACE_ADDRESS as `0x${string}`,
          abi: MarketplaceABI.abi,
          functionName: "getCollectionListings",
          args: [collectionAddress],
        });

        // Process listings into a map by tokenId
        if (Array.isArray(result)) {
          result.forEach((listing: any) => {
            if (listing.status === 1) {
              // Active listing
              listingsMap[Number(listing.tokenId)] = {
                price: listing.price,
                seller: listing.seller,
                active: true,
              };
            }
          });
        }
      } else {
        console.warn(
          "getCollectionListings function not found in Marketplace ABI"
        );
      }
    } catch (err) {
      console.error("Error fetching collection listings:", err);
    }

    // Process owner data
    const owners = await Promise.all(ownerPromises);

    // Process metadata in smaller batches to avoid overwhelming network
    const BATCH_SIZE = 5;
    const batches = Math.ceil(nfts.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, nfts.length);
      const batchNfts = nfts.slice(start, end);

      try {
        // Process metadata
        const metadataPromises = batchNfts.map((nft) =>
          nft.tokenURI ? fetchFromIPFS(nft.tokenURI).catch(() => null) : null
        );

        const metadataResults = await Promise.all(metadataPromises);

        // Update cache with new data
        batchNfts.forEach((nft, idx) => {
          const tokenId = nft.tokenId;
          const ownerIndex = nfts.findIndex((n) => n.tokenId === tokenId);

          if (ownerIndex >= 0 && ownerIndex < owners.length) {
            nft.owner = owners[ownerIndex] as string;
          }

          if (metadataResults[idx]) {
            nft.metadata = metadataResults[idx];
          }

          if (listingsMap[tokenId]) {
            nft.listing = listingsMap[tokenId];
          }

          // Update all instances of this NFT in all cache entries
          Object.keys(nftCache).forEach((key) => {
            if (key.startsWith(collectionAddress)) {
              const cachedNftIndex = nftCache[key].data.findIndex(
                (cachedNft) => cachedNft.tokenId === tokenId
              );
              if (cachedNftIndex !== -1) {
                nftCache[key].data[cachedNftIndex] = { ...nft };
              }
            }
          });
        });
      } catch (err) {
        console.error(`Error processing batch ${i}:`, err);
      }

      // Small delay between batches to avoid overwhelming network
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  } catch (err) {
    console.error("Error in background fetching:", err);
  }
}

// Hook for paginated NFTs with SWR
export function useCollectionNFTsPaginated(
  collectionAddress: string,
  page: number = 1,
  pageSize: number = PAGE_SIZE
) {
  const { data, error, isValidating, mutate } = useSWR(
    collectionAddress ? `${collectionAddress}:${page}:${pageSize}` : null,
    fetchCollectionNFTs,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30 seconds
      refreshInterval: 60000, // 1 minute refresh
    }
  );

  return {
    nfts: data?.nfts || [],
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalCount ? Math.ceil(data.totalCount / pageSize) : 0,
    isLoading: isValidating,
    isError: !!error,
    refresh: mutate,
    currentPage: page,
  };
}

// Helper hook for fetching listing data for a collection
export function useCollectionListings(collectionAddress: string) {
  const { data, error, isValidating, mutate } = useSWR(
    collectionAddress ? `listings:${collectionAddress}` : null,
    async () => {
      try {
        const publicClient = createPublicClient({
          chain: getActiveChain(),
          transport: http(),
        });

        // Check if the function exists in the ABI
        const hasGetCollectionListings = MarketplaceABI.abi.some(
          (item: any) =>
            item.name === "getCollectionListings" && item.type === "function"
        );

        if (!hasGetCollectionListings) {
          console.warn(
            "getCollectionListings function not found in Marketplace ABI"
          );
          return {};
        }

        const result = await publicClient.readContract({
          address: MARKETPLACE_ADDRESS as `0x${string}`,
          abi: MarketplaceABI.abi,
          functionName: "getCollectionListings",
          args: [collectionAddress],
        });

        const listings: Record<string, any> = {};

        // Process listings into a map by tokenId
        if (Array.isArray(result)) {
          result.forEach((listing: any) => {
            if (listing.status === 1) {
              // Active listing
              listings[Number(listing.tokenId)] = {
                price: listing.price,
                seller: listing.seller,
                status: "Active",
                quantity: 1, // Default for ERC721
              };
            }
          });
        }

        return listings;
      } catch (err) {
        console.error("Error fetching collection listings:", err);
        return {};
      }
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000, // 15 seconds
    }
  );

  return {
    floorListings: data || {},
    isLoading: isValidating,
    isError: !!error,
    refetch: mutate,
  };
}
