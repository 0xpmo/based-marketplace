// components/nfts/ERC1155NftCard.tsx
import React from "react";
import Image from "next/image";
import { ERC1155Item } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { motion } from "framer-motion";
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

interface ERC1155NftCardProps {
  token: ERC1155Item;
  showQuantity?: boolean;
  userOwned?: boolean;
}

const ERC1155NftCard: React.FC<ERC1155NftCardProps> = ({
  token,
  showQuantity = true,
  userOwned = false,
}) => {
  // Get image URL from metadata, or use placeholder
  const imageUrl = token.metadata?.image
    ? getIPFSGatewayURL(token.metadata.image)
    : "/images/placeholder-nft.svg";

  // Determine card border color based on rarity
  const borderColorClass =
    token.rarity !== undefined
      ? RARITY_COLORS[token.rarity as keyof typeof RARITY_COLORS] ||
        "bg-blue-500"
      : "bg-blue-500";

  return (
    <motion.div
      whileHover={{
        y: -5,
        boxShadow:
          "0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
      }}
      className={`rounded-xl overflow-hidden bg-blue-900/30 border border-blue-800/30 shadow-lg hover:shadow-2xl transition-all duration-300
        ${userOwned ? "ring-2 ring-purple-500" : ""}`}
    >
      {/* Rarity Banner */}
      {token.rarity !== undefined && (
        <div
          className={`${borderColorClass} text-white px-3 py-1 text-xs font-medium flex justify-between items-center`}
        >
          <span>{RARITY_NAMES[token.rarity]}</span>

          {/* Display token ID for debugging */}
          <span className="opacity-70">#{token.tokenId}</span>
        </div>
      )}

      {/* Image */}
      <div className="aspect-square w-full relative overflow-hidden bg-blue-950">
        <Image
          src={imageUrl}
          alt={token.metadata?.name || `Token #${token.tokenId}`}
          fill
          className="object-cover transition-transform duration-500 hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = "/images/placeholder-nft.svg";
          }}
        />

        {/* For Sale Label */}
        {token.listing && token.listing.active && (
          <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs font-bold">
            For Sale
          </div>
        )}

        {/* Owner Badge */}
        {userOwned && (
          <div className="absolute bottom-2 right-2 bg-purple-700/80 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-bold flex items-center">
            <span className="mr-1">Owned</span>
            <span>💎</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-blue-100 truncate">
          {token.metadata?.name || `Token #${token.tokenId}`}
        </h3>
        <p className="text-sm text-blue-300 truncate mb-2">
          {token.metadata?.description?.substring(0, 50) || "No description"}
          {(token.metadata?.description?.length ?? 0) > 50 ? "..." : ""}
        </p>

        {/* Price or Supply */}
        <div className="flex justify-between items-center mt-2">
          {token.listing && token.listing.active ? (
            <div className="text-green-400 font-medium">
              {formatNumberWithCommas(token.listing.price)} 𝔹
            </div>
          ) : (
            <div className="text-blue-400 font-medium">
              {showQuantity ? `Supply: ${token.supply}` : ""}
            </div>
          )}

          {/* Display user's balance or quantity if applicable */}
          {userOwned && token.balance > 0 && (
            <div className="bg-purple-900/40 border border-purple-700/30 rounded px-2 py-1 text-xs text-purple-300">
              Qty: {token.balance}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ERC1155NftCard;
