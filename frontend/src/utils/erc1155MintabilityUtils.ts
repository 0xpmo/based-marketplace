// utils/erc1155MintabilityUtils.ts
import { ERC1155Collection } from "@/types/contracts";

/**
 * Checks if an ERC1155 collection has available tokens to mint
 * This is a more generic approach that works with different ERC1155 implementations
 *
 * @param collection The ERC1155 collection to check
 * @returns True if tokens are available for minting
 */
export async function hasAvailableERC1155Tokens(
  collection: ERC1155Collection | null
): Promise<boolean> {
  if (!collection) return false;

  try {
    // First, check if the contract is paused - if it is, it's not mintable
    if (collection.paused || collection.mintingEnabled === false) {
      return false;
    }

    // Check if there are any characters with at least one rarity that has available supply
    if (collection.characters && collection.characters.length > 0) {
      // Get available characters for each rarity (0-3 for Bronze, Silver, Gold, Green)
      // We'll check Bronze (0) first as it's typically the most common
      const contractAddress = collection.address as `0x${string}`;

      // Try to fetch available characters for Bronze rarity
      const response = await fetch(
        `/api/contracts/erc1155/availableCharacters?collection=${contractAddress}&rarity=0`
      );

      if (response.ok) {
        const data = await response.json();
        const availableCharacters = data.availableCharacters || [];

        // If there are any available characters, return true
        return availableCharacters.length > 0;
      }

      // If the API call failed, we fall back to a simpler check
      // Just check if there are active characters
      return collection.characters.some((char) => char.enabled);
    }

    // As a last resort fallback, if the contract has rarity prices set and is not paused, assume it's mintable
    return (
      collection.rarityPrices !== undefined &&
      Object.keys(collection.rarityPrices).length > 0 &&
      Object.values(collection.rarityPrices).some((price) => Number(price) > 0)
    );
  } catch (error) {
    console.error("Error checking ERC1155 mintability:", error);
    // If we can't determine, default to false (not mintable)
    return false;
  }
}

/**
 * Get the mint status text for an ERC1155 collection
 *
 * @param collection The ERC1155 collection
 * @param isMintable Whether tokens are available for minting
 * @returns Text describing the mint status
 */
export function getERC1155MintStatusText(
  collection: ERC1155Collection | null,
  isMintable: boolean
): string {
  if (!collection) return "Unknown";

  if (collection.mintingEnabled === false) {
    return "Minting Paused";
  }

  if (!isMintable) {
    return "Sold Out";
  }

  return "Available";
}
