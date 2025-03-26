import { Collection, NFT } from "../types";
import { mockCollections, mockNFTs } from "../mock/data";
import {
  getToolsCollections,
  getToolsCollection,
  getToolsCollectionNFTs,
  getToolsNFT,
} from "./nft-tools-integration";

// Whether to use mock data or real data
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/**
 * Gets all collections
 * In a real app, this would fetch from an API or blockchain
 */
export async function getCollections(): Promise<Collection[]> {
  if (USE_MOCK_DATA) {
    return mockCollections;
  }

  try {
    // Try to get real collections from NFT tools
    const realCollections = await getToolsCollections();

    // If no real collections found, fall back to mock data
    return realCollections.length > 0 ? realCollections : mockCollections;
  } catch (error) {
    console.error(
      "Failed to get collections from nft-tools, using mock data:",
      error
    );
    return mockCollections;
  }
}

/**
 * Gets a single collection by ID
 */
export async function getCollection(id: string): Promise<Collection | null> {
  if (USE_MOCK_DATA) {
    return mockCollections.find((c) => c.id === id) || null;
  }

  try {
    // Try to get real collection from NFT tools
    const realCollection = await getToolsCollection(id);

    // If no real collection found, check mock data
    if (realCollection) {
      return realCollection;
    } else {
      return mockCollections.find((c) => c.id === id) || null;
    }
  } catch (error) {
    console.error(
      `Failed to get collection ${id} from nft-tools, using mock data:`,
      error
    );
    return mockCollections.find((c) => c.id === id) || null;
  }
}

/**
 * Gets NFTs for a collection
 */
export async function getCollectionNFTs(collectionId: string): Promise<NFT[]> {
  if (USE_MOCK_DATA) {
    return mockNFTs.filter((nft) => nft.collection_id === collectionId);
  }

  try {
    // Try to get real NFTs from NFT tools
    const realNFTs = await getToolsCollectionNFTs(collectionId);

    // If no real NFTs found, check mock data
    if (realNFTs.length > 0) {
      return realNFTs;
    } else {
      return mockNFTs.filter((nft) => nft.collection_id === collectionId);
    }
  } catch (error) {
    console.error(
      `Failed to get NFTs for collection ${collectionId} from nft-tools, using mock data:`,
      error
    );
    return mockNFTs.filter((nft) => nft.collection_id === collectionId);
  }
}

/**
 * Gets a single NFT by collection ID and token ID
 */
export async function getNFT(
  collectionId: string,
  tokenId: string
): Promise<NFT | null> {
  if (USE_MOCK_DATA) {
    return (
      mockNFTs.find(
        (n) =>
          n.collection_id === collectionId && n.token_id.toString() === tokenId
      ) || null
    );
  }

  try {
    // Try to get real NFT from NFT tools
    const realNFT = await getToolsNFT(collectionId, tokenId);

    // If no real NFT found, check mock data
    if (realNFT) {
      return realNFT;
    } else {
      return (
        mockNFTs.find(
          (n) =>
            n.collection_id === collectionId &&
            n.token_id.toString() === tokenId
        ) || null
      );
    }
  } catch (error) {
    console.error(
      `Failed to get NFT ${tokenId} from collection ${collectionId} from nft-tools, using mock data:`,
      error
    );
    return (
      mockNFTs.find(
        (n) =>
          n.collection_id === collectionId && n.token_id.toString() === tokenId
      ) || null
    );
  }
}

/**
 * In a real app, this would connect to the blockchain and fetch live data
 *
 * You would integrate with ethers.js to:
 * 1. Connect to the NFT contract
 * 2. Fetch metadata from tokenURI
 * 3. Get collection data
 */
export async function connectToCollectionContract(_contractAddress: string) {
  // This is a placeholder for the real implementation
  // You would use ethers.js to connect to the contract

  return {
    getTokenURI: async (tokenId: number) => {
      // This would fetch the tokenURI from the contract
      return `ipfs://example/${tokenId}.json`;
    },
    totalSupply: async () => {
      // This would get the total supply from the contract
      return 100;
    },
    balanceOf: async (_address: string) => {
      // This would get the balance of tokens for an address
      return 1;
    },
  };
}
