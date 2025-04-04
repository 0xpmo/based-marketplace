// hooks/useAllContracts.ts
import { useMemo } from "react";
import { useBasedCollections } from "./useERC721Contracts";
import { useERC1155Collections } from "./useERC1155Contracts";
import useSWR from "swr";

// Custom fetch function to combine collections
const fetchAllCollections = async (key: string) => {
  // We'll implement the actual fetching logic in each hook
  // This is just a placeholder to make SWR work with our existing hooks
  return null;
};

// Combined hook that fetches both normal collections and ERC1155 collections
export function useAllCollections() {
  const {
    collections: standardCollections,
    loading: standardLoading,
    error: standardError,
    refreshCollections: refreshStandardCollections,
  } = useBasedCollections();

  const {
    collections: erc1155Collections,
    loading: erc1155Loading,
    error: erc1155Error,
    refreshCollections: refreshERC1155Collections,
  } = useERC1155Collections();

  // Use SWR for caching the combined collections result
  const { data: cachedCollections, mutate } = useSWR(
    "all-collections",
    fetchAllCollections,
    {
      fallbackData: [...standardCollections, ...erc1155Collections],
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10000, // 10 seconds
    }
  );

  // Combine the collections with standard collections coming first
  const collections = useMemo(() => {
    return cachedCollections || [...standardCollections, ...erc1155Collections];
  }, [cachedCollections, standardCollections, erc1155Collections]);

  const loading = standardLoading || erc1155Loading;
  const error = standardError || erc1155Error;

  const refreshCollections = () => {
    refreshStandardCollections();
    refreshERC1155Collections();
    mutate(); // Update the SWR cache
  };

  return { collections, loading, error, refreshCollections };
}

// Re-export everything for convenience
// export * from "./useERC721Contracts";
// export * from "./useERC1155Contracts";
// export * from "./useMarketplace";
// export * from "./useCollectionFactory";
// export * from "./useSharedTypes";
