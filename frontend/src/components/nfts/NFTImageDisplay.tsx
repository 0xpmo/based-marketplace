// components/nfts/NFTImageDisplay.tsx
import { motion } from "framer-motion";
import Image from "next/image";
import { NFTItem, ERC1155Item } from "@/types/contracts";

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
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
      className={`bg-blue-900/30 border border-blue-800/30 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 backdrop-blur-sm relative
        ${isOwned ? "ring-4 ring-purple-500/30" : ""}`}
    >
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
