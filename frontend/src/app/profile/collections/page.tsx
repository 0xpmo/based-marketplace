"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import Image from "next/image";
import PepeButton from "@/components/ui/PepeButton";
import { useCollections } from "@/hooks/useContracts";
import { Collection } from "@/types/contracts";
import { getIPFSGatewayURL } from "@/services/ipfs";

export default function ProfileCollectionsPage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"collections" | "hidden">(
    "collections"
  );
  const { collections, loading: isLoading } = useCollections();
  const [userCollections, setUserCollections] = useState<Collection[]>([]);

  // Fetch user collections
  useEffect(() => {
    if (address) {
      // Filter collections by creator (owner)
      setUserCollections(
        collections.filter((collection) => collection.owner === address)
      );
    }
  }, [address, collections]);

  if (!isConnected) {
    return (
      <div className="container mx-auto max-w-5xl py-16 px-4 text-center">
        <h1 className="text-3xl font-bold mb-8">Your Collections</h1>
        <div className="bg-card border border-border rounded-xl p-10 shadow-lg">
          <p className="text-xl mb-6">
            Please connect your wallet to view your collections
          </p>
          <PepeButton variant="primary" className="mx-auto">
            Connect Wallet
          </PepeButton>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Collections</h1>
        <Link href="/collections/create">
          <PepeButton variant="primary">Create New Collection</PepeButton>
        </Link>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab("collections")}
          className={`py-3 px-6 font-medium ${
            activeTab === "collections"
              ? "border-b-2 border-primary text-white"
              : "text-gray-400"
          }`}
        >
          Collections
        </button>
        <button
          onClick={() => setActiveTab("hidden")}
          className={`py-3 px-6 font-medium ${
            activeTab === "hidden"
              ? "border-b-2 border-primary text-white"
              : "text-gray-400"
          }`}
        >
          Hidden
        </button>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-10 shadow-lg text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading your collections...</p>
        </div>
      ) : userCollections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userCollections.map((collection) => (
            <CollectionCard key={collection.address} collection={collection} />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-10 shadow-lg text-center">
          <p className="text-xl mb-6">
            You haven&apos;t created any collections yet
          </p>
          <Link href="/collections/create">
            <PepeButton variant="primary">
              Create Your First Collection
            </PepeButton>
          </Link>
        </div>
      )}
    </div>
  );
}

interface CollectionCardProps {
  collection: Collection;
}

function CollectionCard({ collection }: CollectionCardProps) {
  // Determine if collection is public (could be stored in contract or added to the Collection type)
  const isPublic = true; // Placeholder - should come from collection or a property
  const [imageUrl, setImageUrl] = useState(
    "/images/placeholder-collection.svg"
  );
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (collection.metadata?.image && !imageError) {
      try {
        const url = getIPFSGatewayURL(collection.metadata.image);
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
  }, [collection.metadata?.image, imageError]);

  return (
    <Link href={`/collections/${collection.address}/edit`}>
      <div className="bg-gradient-to-b from-blue-900/60 to-blue-950/80 border border-blue-800/50 rounded-xl overflow-hidden hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-900/30 transition-all duration-300">
        <div className="h-40 relative group">
          {isImageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-900/50 z-20">
              <div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <Image
            src={imageUrl}
            alt={collection.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => {
              setImageError(true);
              setImageUrl("/images/placeholder-collection.svg");
              setIsImageLoading(false);
            }}
            onLoad={() => setIsImageLoading(false)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 to-transparent opacity-70"></div>
        </div>
        <div className="p-4 relative z-10">
          <h3 className="text-lg font-bold mb-1 truncate text-cyan-100">
            {collection.name}
          </h3>
          <div className="flex justify-between items-center">
            <div className="text-sm text-cyan-200/80">
              {collection.totalMinted} / {collection.maxSupply} minted
            </div>
            <div
              className={`text-xs px-2 py-1 rounded ${
                isPublic
                  ? "bg-green-900/50 text-green-400 border border-green-700/30"
                  : "bg-yellow-900/50 text-yellow-400 border border-yellow-700/30"
              }`}
            >
              {isPublic ? "Public" : "Hidden"}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
