"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import Image from "next/image";
import { useCollections } from "@/hooks/useContracts";
import PepeButton from "@/components/ui/PepeButton";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { Collection } from "@/types/contracts";

// Simple loading state component
const LoadingState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
    <p className="text-gray-400">{message}</p>
  </div>
);

export default function MyCollectionsPage() {
  const { address, isConnected } = useAccount();
  const { collections, loading, error } = useCollections();
  const [myCollections, setMyCollections] = useState<Collection[]>([]);

  useEffect(() => {
    if (collections && address) {
      // Filter collections owned by the current user
      const userCollections = collections.filter(
        (collection) =>
          collection.owner?.toLowerCase() === address?.toLowerCase()
      );
      setMyCollections(userCollections);
    }
  }, [collections, address]);

  if (!isConnected) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">
            Please connect your wallet to view your collections.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6">My Collections</h1>
        <LoadingState message="Loading your collections..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6">My Collections</h1>
        <div className="bg-red-900/30 text-red-400 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Collections</h1>
        <Link href="/collections/create">
          <PepeButton variant="primary">Create New Collection</PepeButton>
        </Link>
      </div>

      {myCollections.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">No Collections Found</h2>
          <p className="text-gray-400 mb-6">
            You haven&apos;t created any collections yet.
          </p>
          <Link href="/collections/create">
            <PepeButton variant="primary">
              Create Your First Collection
            </PepeButton>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myCollections.map((collection) => (
            <div
              key={collection.address}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary transition-colors"
            >
              <div className="aspect-video relative bg-black/20">
                {collection.metadata?.image ? (
                  <Image
                    src={getIPFSGatewayURL(collection.metadata.image)}
                    alt={collection.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    No Image
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-black/70 text-xs font-medium px-2 py-1 rounded-full">
                  {collection.mintingEnabled ? (
                    <span className="text-green-400">Live</span>
                  ) : (
                    <span className="text-amber-400">Draft</span>
                  )}
                </div>
              </div>

              <div className="p-4">
                <h3 className="text-lg font-bold mb-1">{collection.name}</h3>
                <p className="text-sm text-gray-400 mb-2">
                  {collection.symbol} • {collection.totalMinted}/
                  {collection.maxSupply} minted
                </p>
                <p className="text-sm text-gray-400 mb-4">
                  Mint Price: {collection.mintPrice} ETH
                </p>

                <div className="flex gap-2">
                  <Link
                    href={`/collections/${collection.address}/edit`}
                    className="flex-1"
                  >
                    <PepeButton variant="outline" className="w-full">
                      Edit Collection
                    </PepeButton>
                  </Link>
                  <Link
                    href={`/collections/${collection.address}/manage`}
                    className="flex-1"
                  >
                    <PepeButton variant="primary" className="w-full">
                      Manage NFTs
                    </PepeButton>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
