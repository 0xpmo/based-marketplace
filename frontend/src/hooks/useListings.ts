"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getActiveListingsForToken,
  getActiveListingsBySeller,
  getActiveListingsForCollection,
  Listing,
} from "@/lib/db";
import { useAccount } from "wagmi";
import { useDeepCompareEffect } from "@/utils/deepComparison";

/**
 * Hook to fetch all active listings for a specific token
 */
export function useTokenListings(
  nftContract: string,
  tokenId: string | number
) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchListings = useCallback(async () => {
    if (!nftContract || !tokenId) {
      setListings([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(
        "fetching listings from useTokenListings in UseListings file"
      );
      const tokenIdStr =
        typeof tokenId === "number" ? tokenId.toString() : tokenId;
      const result = await getActiveListingsForToken(nftContract, tokenIdStr);
      setListings(result);
    } catch (err) {
      console.error("Error fetching token listings:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch listings")
      );
      // Set empty array on error to avoid UI issues
      setListings([]);
    } finally {
      // Always set loading to false when the operation completes
      setIsLoading(false);
    }
  }, [nftContract, tokenId]);

  useDeepCompareEffect(() => {
    console.log("fetch listings changed");
    fetchListings();
  }, [fetchListings]);

  return {
    listings,
    isLoading,
    error,
    refetch: fetchListings,
  };
}

/**
 * Hook to fetch all active listings for the current user
 */
export function useMyListings() {
  const { address } = useAccount();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchListings = useCallback(async () => {
    if (!address) {
      setListings([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getActiveListingsBySeller(address);
      setListings(result);
    } catch (err) {
      console.error("Error fetching my listings:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch listings")
      );
      // Set empty array on error to avoid UI issues
      setListings([]);
    } finally {
      // Always set loading to false when the operation completes
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return {
    listings,
    isLoading,
    error,
    refetch: fetchListings,
  };
}

/**
 * Hook to fetch all active listings for a collection
 */
export function useCollectionListings(collectionAddress: string) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchListings = useCallback(async () => {
    if (!collectionAddress) {
      setListings([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getActiveListingsForCollection(collectionAddress);
      setListings(result);
    } catch (err) {
      console.error("Error fetching collection listings:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch listings")
      );
      // Set empty array on error to avoid UI issues
      setListings([]);
    } finally {
      // Always set loading to false when the operation completes
      setIsLoading(false);
    }
  }, [collectionAddress]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Helper method to get listings by tokenId
  const getListingsByTokenId = useCallback(() => {
    const listingsByTokenId: Record<string, Listing[]> = {};

    listings.forEach((listing) => {
      if (!listingsByTokenId[listing.tokenId]) {
        listingsByTokenId[listing.tokenId] = [];
      }

      listingsByTokenId[listing.tokenId].push(listing);
    });

    return listingsByTokenId;
  }, [listings]);

  // Helper method to get the floor listing for each token
  const getFloorListings = useCallback(() => {
    const listingsByTokenId = getListingsByTokenId();
    const floorListings: Record<string, Listing> = {};

    Object.keys(listingsByTokenId).forEach((tokenId) => {
      const tokenListings = [...listingsByTokenId[tokenId]];

      // Sort by price (lowest first)
      tokenListings.sort((a, b) => {
        const priceA = BigInt(a.price);
        const priceB = BigInt(b.price);
        return priceA < priceB ? -1 : priceA > priceB ? 1 : 0;
      });

      // Get the lowest price listing
      floorListings[tokenId] = tokenListings[0];
    });

    return floorListings;
  }, [getListingsByTokenId]);

  return {
    listings,
    listingsByTokenId: getListingsByTokenId(),
    floorListings: getFloorListings(),
    isLoading,
    error,
    refetch: fetchListings,
  };
}
