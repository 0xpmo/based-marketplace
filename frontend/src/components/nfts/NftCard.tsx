// frontend/src/components/nfts/NFTCard.tsx
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { NFTItem } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";
import PepeButton from "../ui/PepeButton";

interface NFTCardProps {
  nft: NFTItem;
  collectionAddress: string;
}

export default function NFTCard({ nft, collectionAddress }: NFTCardProps) {
  const { tokenId, metadata, owner, listing } = nft;

  // Default image if none provided
  const imageUrl = metadata?.image
    ? getIPFSGatewayURL(metadata.image)
    : "/images/placeholder-nft.png";

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  return (
    <motion.div
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-card rounded-xl overflow-hidden shadow-lg border border-border hover:border-pepe-500 transition-colors"
    >
      <Link
        href={`/collections/${collectionAddress}/${tokenId}`}
        className="block"
      >
        <div className="relative h-60 w-full">
          <Image
            src={imageUrl}
            alt={metadata?.name || `NFT #${tokenId}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>

        <div className="p-4">
          <h3 className="text-lg font-bold text-foreground mb-1">
            {metadata?.name || `NFT #${tokenId}`}
          </h3>

          <p className="text-sm text-gray-400 mb-3">
            Owned by: {formatAddress(owner)}
          </p>

          {listing && listing.active ? (
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Price</p>
                <p className="text-lg font-bold text-pepe-400">
                  {parseFloat(listing.price).toFixed(4)} BAI
                </p>
              </div>
              <PepeButton variant="primary" size="sm">
                Buy Now
              </PepeButton>
            </div>
          ) : (
            <div className="mt-3">
              <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                Not for sale
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
