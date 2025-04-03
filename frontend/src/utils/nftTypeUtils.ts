// utils/nftTypeUtils.ts
import { NFTItem, ERC1155Item } from "@/types/contracts";

/**
 * Utility to determine if an item is an ERC1155Item
 * @param item The NFT item to check
 * @returns True if the item is an ERC1155Item
 */
export function isERC1155Item(
  item: NFTItem | ERC1155Item | null
): item is ERC1155Item {
  return (
    item !== null &&
    (item as ERC1155Item).supply !== undefined &&
    (item as ERC1155Item).balance !== undefined
  );
}

/**
 * Utility to safely convert an NFTItem to an ERC1155Item if applicable
 * @param item The NFT item to convert
 * @returns The item as an ERC1155Item or null if not an ERC1155Item
 */
export function asERC1155Item(
  item: NFTItem | ERC1155Item | null
): ERC1155Item | null {
  if (isERC1155Item(item)) {
    return item;
  }
  return null;
}

/**
 * Determines if the current user owns the NFT item
 * @param item The NFT item to check
 * @param userAddress The current user's address
 * @returns True if the user owns the item
 */
export function isOwnedByUser(
  item: NFTItem | ERC1155Item | null,
  userAddress: string | undefined
): boolean {
  if (!item || !userAddress) return false;

  if (isERC1155Item(item)) {
    return item.balance > 0;
  } else {
    return (item as NFTItem).owner.toLowerCase() === userAddress.toLowerCase();
  }
}
