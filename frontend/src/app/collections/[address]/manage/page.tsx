"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Image from "next/image";
import Link from "next/link";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { useCollection, useUpdateCollection } from "@/hooks/useERC721Contracts";
import PepeButton from "@/components/ui/PepeButton";

// Simple loading state component
const LoadingState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-12">
    <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
    <p className="text-gray-400">{message}</p>
  </div>
);

interface NFTItem {
  id: number;
  name: string;
  description: string;
  image: string;
}

export default function ManageCollectionPage() {
  // For now, redirect to the home page
  const router = useRouter();
  router.push("/");
  const { address: collectionAddress } = useParams();
  const { address: walletAddress, isConnected } = useAccount();

  // Get collection data
  const { collection, loading, error } = useCollection(
    collectionAddress as string
  );

  // Collection management hooks
  const { setCollectionPublic, isLoading } = useUpdateCollection(
    collectionAddress as string
  );

  // Local state for NFT management
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  // Get the NFTs for this collection
  useEffect(() => {
    const fetchNFTs = async () => {
      if (!collection) return;

      try {
        // This would be replaced with actual API call
        // For now, just use placeholder data or any NFTs in the collection
        setNfts([]);
      } catch (err) {
        console.error("Error fetching NFTs:", err);
      }
    };

    fetchNFTs();
  }, [collection]);

  // Handle file selection for NFT uploads
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");

    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.floor((i / files.length) * 100));

        // Create form data for the file
        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", `NFT #${nfts.length + i + 1}`);
        formData.append(
          "description",
          `NFT from the ${collection?.name} collection`
        );

        // Upload to IPFS
        const response = await fetch("/api/ipfs/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload file ${file.name}`);
        }

        const data = await response.json();

        // Add to local state
        setNfts((prev) => [
          ...prev,
          {
            id: nfts.length + i + 1,
            name: `NFT #${nfts.length + i + 1}`,
            description: `NFT from the ${collection?.name} collection`,
            image: data.uri,
          },
        ]);
      }

      setUploadProgress(100);
    } catch (err) {
      console.error("Error uploading files:", err);
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload files"
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Remove an NFT from the collection (before publishing)
  const handleRemoveNFT = (index: number) => {
    setNfts((prev) => prev.filter((_, i) => i !== index));
  };

  // Publish the collection - make it live
  const handlePublishCollection = async () => {
    if (!collection) return;
    if (!collection.maxSupply) {
      alert("Collection has no max supply");
      return;
    }

    // Check if we have enough NFTs
    if (nfts.length < collection.maxSupply) {
      alert(
        `You need to upload at least ${collection.maxSupply} NFTs before publishing`
      );
      return;
    }

    try {
      // Call the contract to enable minting
      await setCollectionPublic(true);

      // Redirect to collection page
      router.push(`/collections/${collectionAddress}`);
    } catch (err) {
      console.error("Error publishing collection:", err);
      alert("Failed to publish collection. Please try again.");
    }
  };

  // Access check - only collection owner can manage
  if (
    collection &&
    walletAddress &&
    collection.owner.toLowerCase() !== walletAddress.toLowerCase()
  ) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-red-900/30 text-red-400 p-6 rounded-xl">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>
            Only the collection owner can manage this collection. Please connect
            with the owner wallet.
          </p>
          <Link href={`/collections/${collectionAddress}`}>
            <PepeButton variant="outline" className="mt-4">
              Back to Collection
            </PepeButton>
          </Link>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">
            Please connect your wallet to manage this collection.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <LoadingState message="Loading collection details..." />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-red-900/30 text-red-400 p-6 rounded-xl">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p>{error || "Failed to load collection details"}</p>
          <Link href="/my-collections">
            <PepeButton variant="outline" className="mt-4">
              Back to My Collections
            </PepeButton>
          </Link>
        </div>
      </div>
    );
  }

  // Collection is already published
  if (collection.mintingEnabled) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="bg-card border border-border rounded-xl p-8">
          <h1 className="text-2xl font-bold mb-4">{collection.name}</h1>
          <div className="bg-amber-900/30 text-amber-400 p-4 rounded-lg mb-6">
            <p>
              This collection is already published and cannot be modified. New
              NFTs cannot be added to a published collection.
            </p>
          </div>

          <Link href={`/collections/${collectionAddress}`}>
            <PepeButton variant="primary">View Collection</PepeButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">{collection.name}</h1>
          <p className="text-gray-400">
            Manage your NFTs before publishing the collection
          </p>
        </div>

        <div className="flex gap-3">
          <Link href={`/collections/${collectionAddress}/edit`}>
            <PepeButton variant="outline">Edit Collection</PepeButton>
          </Link>
          <PepeButton
            variant="primary"
            onClick={handlePublishCollection}
            disabled={
              isLoading ||
              nfts.length < (collection.maxSupply ?? 0) ||
              isUploading
            }
          >
            {isLoading ? "Publishing..." : "Publish Collection"}
          </PepeButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Collection Details</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400">Image</h3>
                <div className="mt-1 aspect-square w-full relative rounded-lg overflow-hidden bg-black/20">
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
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400">Status</h3>
                <p className="mt-1 text-amber-400">Draft - Not Published</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400">NFT Count</h3>
                <p className="mt-1">
                  {nfts.length} / {collection.maxSupply} NFTs
                </p>
                {nfts.length < (collection.maxSupply ?? 0) && (
                  <p className="text-sm text-amber-400 mt-1">
                    You need to upload{" "}
                    {(collection.maxSupply ?? 0) - nfts.length} more NFTs before
                    you can publish
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400">
                  Mint Price
                </h3>
                <p className="mt-1">{collection.mintPrice} ETH</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400">
                  Creator Earnings
                </h3>
                <p className="mt-1">{collection.royaltyFee / 100}%</p>
              </div>

              <div className="pt-4">
                <input
                  type="file"
                  id="nft-upload"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                <PepeButton
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("nft-upload")?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-primary rounded-full mr-2" />
                      Uploading... {uploadProgress}%
                    </span>
                  ) : (
                    "Upload NFT Images"
                  )}
                </PepeButton>

                {uploadError && (
                  <p className="text-red-400 text-sm mt-2">{uploadError}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">NFTs</h2>

            {nfts.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
                <p className="text-gray-400 mb-4">
                  No NFTs yet. Upload some images to add to your collection.
                </p>
                <PepeButton
                  variant="outline"
                  onClick={() => document.getElementById("nft-upload")?.click()}
                  disabled={isUploading}
                >
                  Upload NFT Images
                </PepeButton>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {nfts.map((nft, index) => (
                  <div
                    key={index}
                    className="border border-border rounded-lg overflow-hidden"
                  >
                    <div className="aspect-square relative bg-black/20">
                      <Image
                        src={getIPFSGatewayURL(nft.image)}
                        alt={nft.name}
                        fill
                        className="object-cover"
                      />
                      <button
                        className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 rounded-full w-6 h-6 flex items-center justify-center"
                        onClick={() => handleRemoveNFT(index)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-white"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold truncate">{nft.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
