// frontend/src/components/nfts/NFTCard.tsx
"use client";

import { useState, useEffect, memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { NFTItem } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { useAccount } from "wagmi";
import { useTokenPrice } from "@/contexts/TokenPriceContext";

interface NFTCardProps {
  nft: NFTItem;
  collectionAddress?: string;
}

// Using memo to prevent unnecessary re-renders when sorting/filtering
const NFTCard = memo(function NFTCard({
  nft,
  collectionAddress,
}: NFTCardProps) {
  const { address } = useAccount(); // Get current user's wallet address
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(
    "/images/placeholder-nft.svg"
  );
  const [isImageLoading, setIsImageLoading] = useState(true);

  // Use the shared token price context instead of individual state
  const { tokenUSDRate, calculateUSDPrice, formatNumberWithCommas } =
    useTokenPrice();

  // Use collection address from props or from NFT object
  const collection = collectionAddress || nft.collection;

  // Check if this NFT belongs to the current user
  const isOwnedByUser =
    address && nft.owner.toLowerCase() === address.toLowerCase();

  // Set image URL with error handling - add nft.tokenId as a dependency
  // to ensure same NFT gets same image URL and doesn't reload unnecessarily
  useEffect(() => {
    // If we already have a non-placeholder image URL for this token, don't reload
    const tokenImageKey = `nft-image-${collection}-${nft.tokenId}`;
    const cachedImageUrl = sessionStorage.getItem(tokenImageKey);

    if (cachedImageUrl && cachedImageUrl !== "/images/placeholder-nft.svg") {
      setImageUrl(cachedImageUrl);
      setIsImageLoading(false);
      return;
    }

    if (nft?.metadata?.image && !imageError) {
      try {
        const url = getIPFSGatewayURL(nft.metadata.image);

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
  }, [collection, nft.tokenId, nft?.metadata?.image, imageError]);

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Calculate USD price for NFT if it's listed
  const usdPrice =
    nft.listing && nft.listing.active && tokenUSDRate
      ? calculateUSDPrice(nft.listing.price)
      : null;

  return (
    <Link
      href={`/collections/${collection}/${nft.tokenId}`}
      className="block h-full"
    >
      <div className="bg-blue-900/30 border border-blue-800/30 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 h-full backdrop-blur-sm relative group cursor-pointer hover:scale-[1.03]">
        {/* Image Container */}
        <div className="aspect-square relative overflow-hidden">
          {/* Your NFT Badge - only shown when user owns this NFT */}
          {isOwnedByUser && (
            <div className="absolute top-3 left-3 z-20 bg-gradient-to-r from-purple-600 to-blue-500 px-3 py-1 rounded-full shadow-lg border border-purple-300/30">
              <div className="flex items-center">
                <span>💎</span>
                <span className="text-xs font-bold ml-1 text-white tracking-wide">
                  Yours
                </span>
              </div>
            </div>
          )}

          {/* Existing loading indicator - only show on initial load */}
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-900/50 z-10">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {/* Rest of your existing code */}
          <Image
            src={imageUrl}
            alt={nft.metadata?.name || `NFT #${nft.tokenId}`}
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
          {nft.listing && nft.listing.active && (
            <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full font-semibold text-sm shadow-lg z-10">
              For Sale
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
              {nft.metadata?.name || `NFT #${nft.tokenId}`}
            </h3>

            <div className="flex justify-between items-center mb-2">
              <div className="text-sm text-blue-300 font-medium">
                #{nft.tokenId}
              </div>
              <div className="text-xs text-blue-400 flex items-center">
                {isOwnedByUser ? (
                  <span className="text-purple-300 font-semibold">You</span>
                ) : (
                  formatAddress(nft.owner)
                )}
              </div>
            </div>

            {/* Price Display */}
            {nft.listing && nft.listing.active && (
              <div className="mt-2 pt-2 border-t border-blue-800/30">
                <div className="text-xs text-blue-400">Price</div>
                <div className="text-blue-100 font-semibold">
                  𝔹 {formatNumberWithCommas(parseInt(nft.listing.price))}
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

export default NFTCard;
