// hooks/useAllContracts.ts
import { useMemo } from "react";
import { useBasedCollections } from "./useERC721Contracts";
import { useERC1155Collections } from "./useERC1155Contracts";

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

  // Combine the collections with standard collections coming first
  const collections = useMemo(() => {
    return [...standardCollections, ...erc1155Collections];
  }, [standardCollections, erc1155Collections]);

  const loading = standardLoading || erc1155Loading;
  const error = standardError || erc1155Error;

  const refreshCollections = () => {
    refreshStandardCollections();
    refreshERC1155Collections();
  };

  return { collections, loading, error, refreshCollections };
}

// Re-export everything for convenience
// export * from "./useERC721Contracts";
// export * from "./useERC1155Contracts";
// export * from "./useMarketplace";
// export * from "./useCollectionFactory";
// export * from "./useSharedTypes";
