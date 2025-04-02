// utils/collectionStateUtils.ts
import { Collection } from "@/types/contracts";
import { isERC1155Collection } from "./collectionTypeDetector";

/**
 * Checks if a collection's minting is paused
 * @param collection The collection to check
 * @returns True if minting is paused
 */
export function isCollectionPaused(collection: Collection | null): boolean {
  if (!collection) return false;
  return collection.paused || collection.mintingEnabled === false;
}

/**
 * Checks if an ERC721 collection is sold out (all tokens minted)
 * @param collection The collection to check
 * @returns True if the collection is sold out
 */
export function isCollectionSoldOut(collection: Collection | null): boolean {
  if (!collection) return false;

  // ERC1155 collections don't really have a "sold out" state in the same way
  if (isERC1155Collection(collection)) return false;

  return Number(collection.totalMinted) >= Number(collection.maxSupply);
}

/**
 * Checks if new tokens can be minted from this collection
 * @param collection The collection to check
 * @returns True if minting is available
 */
export function isMintingAvailable(collection: Collection | null): boolean {
  if (!collection) return false;

  // If paused, minting is not available
  if (isCollectionPaused(collection)) return false;

  // For ERC721, check sold out state
  if (!isERC1155Collection(collection)) {
    return !isCollectionSoldOut(collection);
  }

  // For ERC1155, if not paused, it's generally mintable
  return true;
}

/**
 * Gets the appropriate text for a mint button based on collection state
 * @param collection The collection
 * @returns Text to display on mint button
 */
export function getMintButtonText(collection: Collection | null): string {
  if (!collection) return "Mint NFT";

  if (isCollectionPaused(collection)) {
    return "Minting Disabled";
  }

  if (!isERC1155Collection(collection) && isCollectionSoldOut(collection)) {
    return "Sold Out";
  }

  return "Mint NFT";
}
