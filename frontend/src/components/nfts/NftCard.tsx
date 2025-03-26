// frontend/src/components/nfts/NFTCard.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { NFTItem } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { useAccount } from "wagmi";

interface NFTCardProps {
  nft: NFTItem;
  collectionAddress?: string;
}

export default function NFTCard({ nft, collectionAddress }: NFTCardProps) {
  const { address } = useAccount(); // Get current user's wallet address
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(
    "/images/placeholder-nft.svg"
  );
  const [isImageLoading, setIsImageLoading] = useState(true);

  // Use collection address from props or from NFT object
  const collection = collectionAddress || nft.collection;

  // Check if this NFT belongs to the current user
  const isOwnedByUser =
    address && nft.owner.toLowerCase() === address.toLowerCase();

  // Set image URL with error handling
  useEffect(() => {
    if (nft?.metadata?.image && !imageError) {
      try {
        const url = getIPFSGatewayURL(nft.metadata.image);
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
  }, [nft?.metadata?.image, imageError]);

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Create 3-5 random bubbles as decorative elements
  const renderBubbles = () => {
    const numBubbles = Math.floor(Math.random() * 3) + 3; // 3-5 bubbles
    const bubbles = [];

    for (let i = 0; i < numBubbles; i++) {
      const size = Math.floor(Math.random() * 12) + 4; // 4-16px
      const left = Math.floor(Math.random() * 80) + 10; // 10-90%
      const animationDelay = Math.random() * 3; // 0-3s
      const animationDuration = Math.random() * 6 + 4; // 4-10s

      bubbles.push(
        <div
          key={i}
          className="absolute rounded-full bg-blue-400/20 z-10 pointer-events-none"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            left: `${left}%`,
            bottom: "0%",
            animationDelay: `${animationDelay}s`,
            animationDuration: `${animationDuration}s`,
            animationName: "bubble-rise",
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-in-out",
          }}
        />
      );
    }

    return bubbles;
  };

  return (
    <>
      <Link
        href={`/collections/${collection}/${nft.tokenId}`}
        className="block h-full"
      >
        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.2 }}
          className="bg-blue-900/30 border border-blue-800/30 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 h-full backdrop-blur-sm relative group cursor-pointer"
        >
          {/* Image Container */}
          <div className="aspect-square relative overflow-hidden">
            {/* Your NFT Badge - only shown when user owns this NFT */}
            {isOwnedByUser && (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-3 left-3 z-20 bg-gradient-to-r from-purple-600 to-blue-500 px-3 py-1 rounded-full shadow-lg border border-purple-300/30"
              >
                <div className="flex items-center">
                  <motion.div
                    animate={{ rotate: [0, 10, 0, -10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    💎
                  </motion.div>
                  <span className="text-xs font-bold ml-1 text-white tracking-wide">
                    Yours
                  </span>
                </div>
              </motion.div>
            )}

            {/* Existing loading indicator */}
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
                    {parseFloat(nft.listing.price).toFixed(4)} 𝔹
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add subtle border glow for owned NFTs */}
          {isOwnedByUser && (
            <div className="absolute inset-0 rounded-xl border-2 border-purple-500/30 pointer-events-none"></div>
          )}
        </motion.div>
      </Link>

      <style jsx global>{`
        @keyframes bubble-rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          20% {
            opacity: 0.6;
          }
          50% {
            transform: translateY(-120px) translateX(-15px) scale(1.2);
          }
          80% {
            opacity: 0.2;
          }
          100% {
            transform: translateY(-200px) translateX(15px) scale(0.8);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
