// components/nfts/UnifiedNftCard.tsx
import { useState, useEffect, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { NFTItem, ERC1155Item } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { useAccount } from "wagmi";
import { useTokenPrice } from "@/contexts/TokenPriceContext";
import { formatNumberWithCommas } from "@/utils/formatting";

// Define rarity names for display
const RARITY_NAMES = ["Bronze", "Silver", "Gold", "Green"];
// Define rarity colors for display
const RARITY_COLORS = {
  0: "bg-amber-700", // Bronze
  1: "bg-gray-400", // Silver
  2: "bg-yellow-500", // Gold
  3: "bg-green-500", // Green
};

type UnifiedNftCardProps = {
  item: NFTItem | ERC1155Item;
  collectionAddress?: string;
};

// Helper function to determine if an item is an ERC1155Item
function isERC1155Item(item: NFTItem | ERC1155Item): item is ERC1155Item {
  return (
    (item as ERC1155Item).supply !== undefined &&
    (item as ERC1155Item).rarity !== undefined
  );
}

// Using memo to prevent unnecessary re-renders when sorting/filtering
const UnifiedNftCard = memo(function UnifiedNftCard({
  item,
  collectionAddress,
}: UnifiedNftCardProps) {
  const { address } = useAccount(); // Get current user's wallet address
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(
    "/images/placeholder-nft.svg"
  );
  const [isImageLoading, setIsImageLoading] = useState(true);

  // Use the shared token price context
  const { tokenUSDRate, calculateUSDPrice } = useTokenPrice();

  // Use collection address from props or from NFT object
  const collection = collectionAddress || item.collection;

  // Check if this NFT belongs to the current user
  const isOwnedByUser =
    address &&
    (isERC1155Item(item)
      ? item.balance > 0
      : item.owner.toLowerCase() === address.toLowerCase());

  // Set image URL with error handling
  useEffect(() => {
    // If we already have a non-placeholder image URL for this token, don't reload
    const tokenImageKey = `nft-image-${collection}-${item.tokenId}`;
    const cachedImageUrl = sessionStorage.getItem(tokenImageKey);

    if (cachedImageUrl && cachedImageUrl !== "/images/placeholder-nft.svg") {
      setImageUrl(cachedImageUrl);
      setIsImageLoading(false);
      return;
    }

    if (item?.metadata?.image && !imageError) {
      try {
        const url = getIPFSGatewayURL(item.metadata.image);

        // Cache the image URL in sessionStorage
        sessionStorage.setItem(tokenImageKey, url);

        setImageUrl(url);
        setImageError(false);
        setIsImageLoading(true);
      } catch (err) {
        console.error("Error parsing image URL:", err);
        setImageError(true);
        setImageUrl("/images/placeholder-nft.svg");
        setIsImageLoading(false);
      }
    } else {
      setImageUrl("/images/placeholder-nft.svg");
      setIsImageLoading(false);
    }
  }, [collection, item.tokenId, item?.metadata?.image, imageError]);

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Calculate USD price for NFT if it's listed
  const usdPrice =
    item.listing && item.listing.active && tokenUSDRate
      ? calculateUSDPrice(item.listing.price)
      : null;

  // Determine if the item is an ERC1155 token
  const isERC1155 = isERC1155Item(item);

  // Handle the item name display
  const itemName = item.metadata?.name || `NFT #${item.tokenId}`;

  // Determine border color based on rarity for ERC1155
  const borderColorClass =
    isERC1155 && item.rarity !== undefined
      ? RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] ||
        "bg-blue-500"
      : "bg-blue-500";

  return (
    <Link
      href={`/collections/${collection}/${item.tokenId}`}
      className="block h-full"
    >
      <div className="bg-blue-900/30 border border-blue-800/30 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 h-full backdrop-blur-sm relative group cursor-pointer hover:scale-[1.03]">
        {/* Rarity Banner for ERC1155 */}
        {isERC1155 && item.rarity !== undefined && (
          <div
            className={`${borderColorClass} text-white px-3 py-1 text-xs font-medium flex justify-between items-center`}
          >
            <span>{RARITY_NAMES[item.rarity]}</span>
            <span className="opacity-70">#{item.tokenId}</span>
          </div>
        )}

        {/* Image Container */}
        <div className="aspect-square relative overflow-hidden">
          {/* Your NFT Badge - only shown when user owns this NFT */}
          {isOwnedByUser && (
            <div className="absolute top-3 left-3 z-20 bg-gradient-to-r from-purple-600 to-blue-500 px-3 py-1 rounded-full shadow-lg border border-purple-300/30">
              <div className="flex items-center">
                <span>💎</span>
                <span className="text-xs font-bold ml-1 text-white tracking-wide">
                  {isERC1155 ? "Owned" : "Yours"}
                </span>
              </div>
            </div>
          )}

          {/* Loading indicator - only show on initial load */}
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-900/50 z-10">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <Image
            src={imageUrl}
            alt={itemName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => {
              setImageError(true);
              setImageUrl("/images/placeholder-nft.svg");
              setIsImageLoading(false);
            }}
            onLoad={() => setIsImageLoading(false)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            priority
          />

          {/* Sale Badge */}
          {item.listing && item.listing.active && (
            <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full font-semibold text-sm shadow-lg z-10">
              For Sale
            </div>
          )}

          {/* Owner Badge for ERC1155 with count */}
          {isERC1155 && isOwnedByUser && (item as ERC1155Item).balance > 1 && (
            <div className="absolute bottom-2 right-2 bg-purple-700/80 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-bold flex items-center">
              <span>x{(item as ERC1155Item).balance}</span>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="p-4 relative">
          {/* Add subtle glow for owned NFTs */}
          {isOwnedByUser && (
            <div className="absolute inset-0 bg-gradient-to-t from-purple-700/20 via-blue-600/10 to-transparent rounded-b-xl pointer-events-none"></div>
          )}

          {/* Existing gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-blue-950/90 to-blue-900/30 pointer-events-none"></div>

          {/* Content */}
          <div className="relative z-10">
            <h3 className="font-bold text-lg text-white mb-1 truncate">
              {itemName}
            </h3>

            <div className="flex justify-between items-center mb-2">
              {!isERC1155 && (
                <div className="text-sm text-blue-300 font-medium">
                  #{item.tokenId}
                </div>
              )}
              {isERC1155 ? (
                <div className="text-sm text-blue-300 font-medium">
                  Supply: {(item as ERC1155Item).supply}
                </div>
              ) : (
                <div className="text-xs text-blue-400 flex items-center">
                  {isOwnedByUser ? (
                    <span className="text-purple-300 font-semibold">You</span>
                  ) : (
                    formatAddress((item as NFTItem).owner)
                  )}
                </div>
              )}
            </div>

            {/* Price Display */}
            {item.listing && item.listing.active && (
              <div className="mt-2 pt-2 border-t border-blue-800/30">
                <div className="text-xs text-blue-400">Price</div>
                <div className="text-blue-100 font-semibold">
                  𝔹 {formatNumberWithCommas(parseInt(item.listing.price))}
                </div>
                {usdPrice && (
                  <div className="text-xs text-blue-400 mt-0.5">
                    ≈ ${formatNumberWithCommas(usdPrice)} USD
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Add subtle border glow for owned NFTs */}
        {isOwnedByUser && (
          <div className="absolute inset-0 rounded-xl border-2 border-purple-500/30 pointer-events-none"></div>
        )}
      </div>
    </Link>
  );
});

export default UnifiedNftCard;
