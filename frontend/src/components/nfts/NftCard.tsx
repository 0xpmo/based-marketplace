// frontend/src/components/nfts/NFTCard.tsx
"use client";

import { FC } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { NFTItem } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";

interface NFTCardProps {
  nft: NFTItem;
  collectionAddress: string;
}

const NftCard: FC<NFTCardProps> = ({ nft, collectionAddress }) => {
  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Set default image if none exists
  const imageUrl = nft.metadata?.image
    ? getIPFSGatewayURL(nft.metadata.image)
    : "/images/placeholder-nft.png";

  return (
    <motion.div
      className="group bg-card border border-border rounded-lg overflow-hidden transition hover:border-primary hover:shadow-md"
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Link
        href={`/collections/${collectionAddress}/${nft.tokenId}`}
        className="block"
      >
        <div className="relative aspect-square w-full bg-muted overflow-hidden">
          <Image
            src={imageUrl}
            alt={nft.metadata?.name || `NFT #${nft.tokenId}`}
            fill
            className="object-cover transition group-hover:scale-105 duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
        <div className="p-4">
          <h3 className="font-bold truncate">
            {nft.metadata?.name || `NFT #${nft.tokenId}`}
          </h3>

          <div className="flex justify-between items-center mt-2 text-sm">
            <div className="text-gray-400">{formatAddress(nft.owner)}</div>

            {nft.listing && nft.listing.active ? (
              <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-medium">
                {parseFloat(nft.listing.price).toFixed(3)} BAI
              </div>
            ) : (
              <div className="text-gray-400 text-xs">Not for sale</div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default NftCard;
