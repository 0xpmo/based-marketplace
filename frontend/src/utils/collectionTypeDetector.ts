// utils/collectionTypeDetector.ts
import { Collection, ERC1155Collection } from "@/types/contracts";

/**
 * Utility to detect if a collection is an ERC1155 collection
 * @param collection The collection to check
 * @returns True if the collection is an ERC1155 collection
 */
export function isERC1155Collection(
  collection: Collection | null
): collection is ERC1155Collection {
  return (
    collection !== null && (collection as ERC1155Collection).isERC1155 === true
  );
}

/**
 * Utility to safely convert a Collection to an ERC1155Collection if applicable
 * @param collection The collection to convert
 * @returns The collection as an ERC1155Collection or null if not an ERC1155Collection
 */
export function asERC1155Collection(
  collection: Collection | null
): ERC1155Collection | null {
  if (isERC1155Collection(collection)) {
    return collection;
  }
  return null;
}
