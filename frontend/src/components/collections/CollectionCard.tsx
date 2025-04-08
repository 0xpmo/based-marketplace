// frontend/src/components/collections/CollectionCard.tsx
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Collection } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";

interface CollectionCardProps {
  collection: Collection;
}

export default function CollectionCard({ collection }: CollectionCardProps) {
  const { address, name, metadata, totalMinted, maxSupply, source } =
    collection;
  console.log("collection", collection);
  const [imageUrl, setImageUrl] = useState(
    "/images/placeholder-collection.svg"
  );
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // Progress percentage
  const progress = maxSupply > 0 ? (totalMinted / maxSupply) * 100 : 0;

  useEffect(() => {
    if (metadata?.image && !imageError) {
      try {
        const url = getIPFSGatewayURL(metadata.image);
        setImageUrl(url);
        setIsImageLoading(true);
        setImageError(false);
      } catch (error) {
        console.error("Error getting image URL:", error);
        setImageUrl("/images/placeholder-collection.svg");
        setIsImageLoading(false);
        setImageError(true);
      }
    } else {
      setImageUrl("/images/placeholder-collection.svg");
      setIsImageLoading(false);
    }
  }, [metadata?.image, imageError]);

  return (
    <motion.div
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-blue-900/20 rounded-xl overflow-hidden shadow-lg border border-blue-800/30 hover:border-blue-500 transition-colors backdrop-blur-sm"
    >
      <Link href={`/collections/${address}`} className="block">
        <div className="relative h-48 w-full overflow-hidden group">
          {/* {source && (
            <div
              className={`absolute top-2 right-2 z-20 px-2 py-1 rounded-md text-xs font-medium ${
                source === "based"
                  ? "bg-cyan-700/80 text-cyan-100"
                  : "bg-purple-700/80 text-purple-100"
              }`}
            >
              {source === "based" ? "Based" : "External"}
            </div>
          )} */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-950/60 z-10"></div>
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-900/50 z-20">
              <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => {
              setImageError(true);
              setImageUrl("/images/placeholder-collection.svg");
              setIsImageLoading(false);
            }}
            onLoad={() => setIsImageLoading(false)}
          />
        </div>

        <div className="p-4">
          <h3 className="text-xl font-bold bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent mb-2">
            {name}
          </h3>

          <p className="text-sm text-blue-200 mb-3">
            {metadata?.description?.substring(0, 100)}
            {metadata?.description && metadata.description.length > 100
              ? "..."
              : ""}
          </p>

          <div className="flex justify-between items-center">
            <div className="flex-1">
              <div className="h-2 w-full bg-blue-800/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-cyan-400"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-blue-300 mt-1">
                {totalMinted} / {maxSupply} minted
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
