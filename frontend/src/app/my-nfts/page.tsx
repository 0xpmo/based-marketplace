"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { NFTItem } from "@/types/contracts";
import { useCollections } from "@/hooks/useContracts";
import NFTCard from "@/components/nfts/NftCard";
import { getIPFSGatewayURL } from "@/services/ipfs";

export default function MyNFTsPage() {
  const { address } = useAccount();
  const { collections } = useCollections();
  const [myNFTs, setMyNFTs] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserNFTs = async () => {
      if (!address || collections.length === 0) {
        setMyNFTs([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const allNfts: NFTItem[] = [];

        // Fetch NFTs from each collection
        for (const collection of collections) {
          try {
            // Get token IDs for this collection
            const tokenIdsResponse = await fetch(
              `/api/contracts/userTokens?collection=${collection.address}&owner=${address}`
            );
            const { tokenIds } = await tokenIdsResponse.json();

            if (!tokenIds || tokenIds.length === 0) continue;

            // Fetch details for each token
            const nftsFromCollection = await Promise.all(
              tokenIds.map(async (tokenId: number) => {
                // Get token URI
                const tokenURIResponse = await fetch(
                  `/api/contracts/tokenURI?collection=${collection.address}&tokenId=${tokenId}`
                );
                const { tokenURI } = await tokenURIResponse.json();

                // Fetch metadata
                let metadata;
                try {
                  const metadataResponse = await fetch(
                    getIPFSGatewayURL(tokenURI)
                  );
                  metadata = await metadataResponse.json();
                } catch (err) {
                  console.error(
                    `Failed to fetch metadata for token ${tokenId}`,
                    err
                  );
                }

                return {
                  tokenId,
                  tokenURI,
                  owner: address,
                  collection: collection.address,
                  metadata,
                } as NFTItem;
              })
            );

            allNfts.push(...nftsFromCollection);
          } catch (err) {
            console.error(
              `Error fetching NFTs from collection ${collection.address}:`,
              err
            );
            // Continue with next collection
          }
        }

        setMyNFTs(allNfts);
      } catch (err) {
        console.error("Error fetching user NFTs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserNFTs();
  }, [address, collections]);

  // Group NFTs by collection
  const nftsByCollection = myNFTs.reduce((acc, nft) => {
    const collectionAddress = nft.collection;
    if (!acc[collectionAddress]) {
      acc[collectionAddress] = [];
    }
    acc[collectionAddress].push(nft);
    return acc;
  }, {} as Record<string, NFTItem[]>);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My NFTs</h1>

      {!address ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-4">
            Connect your wallet to view your NFTs
          </p>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pepe-500 mx-auto" />
          <p className="mt-4 text-gray-400">Loading your NFTs...</p>
        </div>
      ) : myNFTs.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <h2 className="text-xl font-semibold mb-4">No NFTs Found</h2>
          <p className="text-gray-400 mb-4">
            You don&apos;t own any NFTs yet. Explore collections and mint some!
          </p>
        </div>
      ) : (
        Object.entries(nftsByCollection).map(([collectionAddress, nfts]) => {
          const collection = collections.find(
            (c) => c.address === collectionAddress
          );

          return (
            <div key={collectionAddress} className="mb-12">
              <h2 className="text-2xl font-bold mb-6">
                {collection?.name ||
                  `Collection ${collectionAddress.slice(0, 6)}...`}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {nfts.map((nft) => (
                  <NFTCard
                    key={`${nft.collection}-${nft.tokenId}`}
                    nft={nft}
                    collectionAddress={nft.collection}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
