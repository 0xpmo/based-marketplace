import { mutate } from "swr";
import { appCache } from "./cacheStore";

// Helper to show global loading indicator
export function showBlockchainLoading(
  message: string = "Processing transaction..."
) {
  const event = new CustomEvent("blockchain:loading:show", {
    detail: { message },
  });
  window.dispatchEvent(event);
}

// Helper to hide global loading indicator
export function hideBlockchainLoading() {
  window.dispatchEvent(new Event("blockchain:loading:hide"));
}

// Invalidate collection data (when listings change, etc)
export function invalidateCollectionData(collectionAddress: string) {
  // Clear collection-related caches
  appCache.deleteByPrefix(`listings:${collectionAddress}`);
  appCache.deleteByPrefix(collectionAddress);

  // Trigger SWR to refetch
  mutate((key) => typeof key === "string" && key.includes(collectionAddress));
}

// Helper to handle blockchain transactions with loading indicator and optimistic updates
export async function runWithBlockchainLoading<T>(
  message: string,
  fn: () => Promise<T>,
  onSuccess?: (result: T) => void,
  onError?: (error: unknown) => void
): Promise<T | undefined> {
  try {
    showBlockchainLoading(message);
    const result = await fn();

    if (onSuccess) {
      onSuccess(result);
    }

    return result;
  } catch (error) {
    console.error("Blockchain transaction error:", error);

    if (onError) {
      onError(error);
    }
  } finally {
    hideBlockchainLoading();
  }
}

// Optimistic update for buying an NFT
export function optimisticallyUpdateListingAfterBuy(
  collectionAddress: string,
  tokenId: number
) {
  // Update list of listings by invalidating the data
  invalidateCollectionData(collectionAddress);

  // Update specific token data
  mutate(`token:${collectionAddress}:${tokenId}`);
}
