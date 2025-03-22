"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useAccount } from "wagmi";
import { Collection, NFTItem } from "@/types/contracts";
import PepeButton from "@/components/ui/PepeButton";
import NFTCard from "@/components/nfts/NftCard";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { useCollections } from "@/hooks/useContracts";
import MintNftModal from "@/components/nfts/MintNftModal";

export default function CollectionDetailsPage() {
  const { address } = useParams();
  const { address: userAddress } = useAccount();
  const { collections } = useCollections();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMintModal, setShowMintModal] = useState(false);

  // Find collection from all collections
  useEffect(() => {
    if (collections.length > 0) {
      const collectionData = collections.find(
        (c) => c.address.toLowerCase() === String(address).toLowerCase()
      );
      if (collectionData) {
        setCollection(collectionData);
      }
    }
  }, [collections, address]);

  // Fetch NFT data
  useEffect(() => {
    const fetchNFTs = async () => {
      setLoading(true);

      if (!address) {
        setNfts([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch token IDs from our API endpoint
        const response = await fetch(
          `/api/contracts/collectionTokens?collection=${address}`
        );
        const data = await response.json();

        if (!data.tokenIds || data.tokenIds.length === 0) {
          setNfts([]);
          setLoading(false);
          return;
        }

        const tokenIds = data.tokenIds;

        // Fetch details for each token
        const nftPromises = tokenIds.map(async (id: number) => {
          // Fetch token URI
          const tokenURI = await fetchTokenURI(String(address), id);

          // Fetch owner
          const owner = await fetchTokenOwner(String(address), id);

          // Fetch metadata
          let metadata;
          try {
            const response = await fetch(getIPFSGatewayURL(tokenURI));
            metadata = await response.json();
          } catch (err) {
            console.error(`Failed to fetch metadata for token ${id}`, err);
          }

          return {
            tokenId: id,
            tokenURI,
            owner,
            collection: String(address),
            metadata,
          } as NFTItem;
        });

        const nftItems = await Promise.all(nftPromises);
        setNfts(nftItems);
      } catch (err) {
        console.error("Error fetching NFTs", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNFTs();
  }, [address]);

  // Helper function to fetch token URI
  const fetchTokenURI = async (collectionAddress: string, tokenId: number) => {
    try {
      const result = await fetch(
        `/api/contracts/tokenURI?collection=${collectionAddress}&tokenId=${tokenId}`
      );
      const data = await result.json();
      return data.tokenURI;
    } catch (err) {
      console.error(`Error fetching token URI for ${tokenId}`, err);
      return "";
    }
  };

  // Helper function to fetch token owner
  const fetchTokenOwner = async (
    collectionAddress: string,
    tokenId: number
  ) => {
    try {
      const result = await fetch(
        `/api/contracts/ownerOf?collection=${collectionAddress}&tokenId=${tokenId}`
      );
      const data = await result.json();
      return data.owner;
    } catch (err) {
      console.error(`Error fetching owner for ${tokenId}`, err);
      return "";
    }
  };

  if (!collection) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pepe-500 mx-auto" />
          <p className="mt-4 text-gray-400">Loading collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Collection header */}
      <div className="bg-card rounded-xl overflow-hidden shadow-lg border border-border mb-8">
        <div className="relative h-48 w-full bg-gradient-to-r from-green-900 to-green-700">
          {collection.metadata?.image && (
            <Image
              src={getIPFSGatewayURL(collection.metadata.image)}
              alt={collection.name}
              fill
              className="object-cover opacity-40"
            />
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        <div className="p-6">
          <h1 className="text-3xl font-bold mb-2">{collection.name}</h1>
          <p className="text-gray-400 mb-4">
            {collection.metadata?.description || "No description provided."}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-400">Mint Price</p>
              <p className="text-lg font-bold">{collection.mintPrice} BAI</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Minted</p>
              <p className="text-lg font-bold">
                {collection.totalMinted} / {collection.maxSupply}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Royalty</p>
              <p className="text-lg font-bold">{collection.royaltyFee}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Creator</p>
              <p className="text-lg font-bold truncate">{`${collection.owner.substring(
                0,
                6
              )}...${collection.owner.substring(
                collection.owner.length - 4
              )}`}</p>
            </div>
          </div>

          <PepeButton
            variant="primary"
            onClick={() => setShowMintModal(true)}
            disabled={
              !userAddress || collection.totalMinted >= collection.maxSupply
            }
          >
            {!userAddress
              ? "Connect Wallet to Mint"
              : collection.totalMinted >= collection.maxSupply
              ? "Sold Out"
              : "Mint NFT"}
          </PepeButton>
        </div>
      </div>

      {/* NFTs grid */}
      <h2 className="text-2xl font-bold mb-6">Collection Items</h2>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pepe-500 mx-auto" />
          <p className="mt-4 text-gray-400">Loading NFTs...</p>
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <h3 className="text-xl font-semibold mb-2">No NFTs yet</h3>
          <p className="text-gray-400 mb-6">
            Be the first to mint an NFT in this collection!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {nfts.map((nft) => (
            <NFTCard
              key={nft.tokenId}
              nft={nft}
              collectionAddress={String(address)}
            />
          ))}
        </div>
      )}

      {/* Mint Modal */}
      {showMintModal && collection && (
        <MintNftModal
          collection={collection}
          onClose={() => setShowMintModal(false)}
        />
      )}
    </div>
  );
}
