// frontend/src/components/collections/CollectionCard.tsx
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { Collection } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";

interface CollectionCardProps {
  collection: Collection;
}

export default function CollectionCard({ collection }: CollectionCardProps) {
  const { address, name, metadata, totalMinted, maxSupply } = collection;

  // Default image if none provided
  const imageUrl = metadata?.image
    ? getIPFSGatewayURL(metadata.image)
    : "/images/placeholder-collection.png";

  // Progress percentage
  const progress = maxSupply > 0 ? (totalMinted / maxSupply) * 100 : 0;

  console.log("imageUrl", imageUrl);

  return (
    <motion.div
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-card rounded-xl overflow-hidden shadow-lg border border-border hover:border-pepe-500 transition-colors"
    >
      <Link href={`/collections/${address}`} className="block">
        <div className="relative h-48 w-full">
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized={imageUrl.includes("/api/ipfs/proxy")} // Skip optimization for IPFS images
          />
        </div>

        <div className="p-4">
          <h3 className="text-xl font-bold text-foreground mb-2">{name}</h3>

          <p className="text-sm text-gray-400 mb-3">
            {metadata?.description?.substring(0, 100)}
            {metadata?.description && metadata.description.length > 100
              ? "..."
              : ""}
          </p>

          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pepe-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {totalMinted} / {maxSupply} minted
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
