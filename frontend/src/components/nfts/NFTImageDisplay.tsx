// components/nfts/NFTImageDisplay.tsx
import { motion } from "framer-motion";
import Image from "next/image";
import { NFTItem, ERC1155Item } from "@/types/contracts";
import { isERC1155Item } from "@/utils/nftTypeUtils";

// Define rarity names for display
const RARITY_NAMES = ["Bronze", "Silver", "Gold", "Green"];
// Define rarity colors for display
const RARITY_COLORS = {
  0: "bg-amber-700", // Bronze
  1: "bg-gray-400", // Silver
  2: "bg-yellow-500", // Gold
  3: "bg-green-500", // Green
};

interface NFTImageDisplayProps {
  nftItem: NFTItem | ERC1155Item;
  imageUrl: string;
  isOwned: boolean;
}

const NFTImageDisplay = ({
  nftItem,
  imageUrl,
  isOwned,
}: NFTImageDisplayProps) => {
  // Determine if the item is an ERC1155 token
  const isERC1155 = isERC1155Item(nftItem);

  // Get rarity for ERC1155
  const rarityName =
    isERC1155 && nftItem.rarity !== undefined
      ? RARITY_NAMES[nftItem.rarity]
      : null;

  const rarityColorClass =
    isERC1155 && nftItem.rarity !== undefined
      ? RARITY_COLORS[nftItem.rarity as keyof typeof RARITY_COLORS]
      : null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className={`bg-blue-900/30 border border-blue-800/30 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 backdrop-blur-sm relative
        ${isOwned ? "ring-4 ring-purple-500/30" : ""}`}
    >
      {/* Rarity Banner for ERC1155 */}
      {isERC1155 && rarityName && rarityColorClass && (
        <div
          className={`${rarityColorClass} text-white px-4 py-2 font-medium flex justify-between items-center`}
        >
          <span className="text-lg">{rarityName}</span>
          <span className="opacity-70 text-sm">#{nftItem.tokenId}</span>
        </div>
      )}

      {/* Image Container */}
      <div className="relative aspect-square w-full group">
        <Image
          src={imageUrl}
          alt={nftItem?.metadata?.name || `NFT #${nftItem.tokenId}`}
          fill
          className="object-contain transition-transform duration-500 group-hover:scale-105"
          priority
          onError={(e) => {
            e.currentTarget.src = "/images/placeholder-nft.svg";
          }}
        />

        {nftItem?.listing && nftItem.listing.active && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full font-bold shadow-lg">
            For Sale
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default NFTImageDisplay;
