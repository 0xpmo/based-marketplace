"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAccount } from "wagmi";
import { NFTItem } from "@/types/contracts";
import { useCollection } from "@/hooks/useContracts";
import { getIPFSGatewayURL } from "@/services/ipfs";
import PepeButton from "@/components/ui/PepeButton";
import { fetchFromIPFS } from "@/services/ipfs";
import { useListNFT } from "@/hooks/useContracts";

export default function NFTDetailsPage() {
  const params = useParams();
  const { address: userAddress, isConnected } = useAccount();
  const collectionAddress = params.address as string;
  const tokenId = parseInt(params.tokenId as string);

  // States
  const [nft, setNft] = useState<NFTItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [price, setPrice] = useState("0.001");
  const [txHash, setTxHash] = useState<string | null>(null);

  // Collection data
  const { collection } = useCollection(collectionAddress);

  // List NFT hook
  const {
    listNFT,
    isLoading: isListing,
    isSuccess: isListingSuccess,
    error: listingError,
    txHash: listingTxHash,
    approvalStep,
    approvalTxHash,
  } = useListNFT();

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Fetch NFT data
  useEffect(() => {
    const fetchNFTData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch token details from API
        const response = await fetch(
          `/api/contracts/tokenDetails?collection=${collectionAddress}&tokenId=${tokenId}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch NFT data: ${response.statusText}`);
        }

        const data = await response.json();

        // If there's token URI, fetch metadata
        if (data.tokenURI) {
          try {
            const metadata = await fetchFromIPFS(data.tokenURI);
            data.metadata = metadata;
          } catch (err) {
            console.error("Error fetching metadata:", err);
            data.metadata = null;
          }
        }

        // Check if token is listed
        const listingResponse = await fetch(
          `/api/contracts/tokenListing?collection=${collectionAddress}&tokenId=${tokenId}`
        );

        if (listingResponse.ok) {
          const listingData = await listingResponse.json();
          data.listing = listingData.listing;
        }

        setNft(data);
      } catch (err) {
        console.error("Error fetching NFT details:", err);
        setError("Failed to load NFT details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (collectionAddress && !isNaN(tokenId)) {
      fetchNFTData();
    }
  }, [collectionAddress, tokenId]);

  // Handle listing NFT for sale
  const handleListForSale = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    if (!nft) {
      alert("NFT data not loaded");
      return;
    }

    if (nft.owner.toLowerCase() !== userAddress?.toLowerCase()) {
      alert("You are not the owner of this NFT");
      return;
    }

    try {
      setTxHash(null);
      const success = await listNFT(collectionAddress, tokenId, price);
      if (success && listingTxHash) {
        setTxHash(listingTxHash);
      }
    } catch (err) {
      console.error("Error listing NFT:", err);
    }
  };

  // Handle success - refresh page after listing
  useEffect(() => {
    if (isListingSuccess) {
      // Refresh the page to show updated listing status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }, [isListingSuccess]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto my-8" />
        <p>Loading NFT data...</p>
      </div>
    );
  }

  if (error || !nft) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h1 className="text-3xl font-bold mb-6">Error</h1>
        <p className="text-red-400 mb-4">{error || "NFT not found"}</p>
        <Link href={`/collections/${collectionAddress}`}>
          <PepeButton variant="outline">Back to Collection</PepeButton>
        </Link>
      </div>
    );
  }

  const imageUrl = nft.metadata?.image
    ? getIPFSGatewayURL(nft.metadata.image)
    : "/images/placeholder-nft.png";

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumbs */}
      <nav className="flex mb-6 text-sm text-gray-400">
        <Link href="/" className="hover:text-white">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/collections" className="hover:text-white">
          Collections
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/collections/${collectionAddress}`}
          className="hover:text-white"
        >
          {collection?.name || "Collection"}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-200">#{tokenId}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Section */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
          <div className="relative aspect-square w-full">
            <Image
              src={imageUrl}
              alt={nft.metadata?.name || `NFT #${tokenId}`}
              fill
              className="object-contain"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>

        {/* Details Section */}
        <div className="flex flex-col">
          <div className="bg-card border border-border rounded-xl p-6 shadow-lg mb-6">
            <div className="flex justify-between mb-4">
              <div>
                <Link
                  href={`/collections/${collectionAddress}`}
                  className="text-sm text-primary hover:underline"
                >
                  {collection?.name || "Collection"}
                </Link>
                <h1 className="text-3xl font-bold mt-1">
                  {nft.metadata?.name || `NFT #${tokenId}`}
                </h1>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Token ID</div>
                <div className="font-mono">{tokenId}</div>
              </div>
            </div>

            <div className="flex mb-6 text-sm">
              <div className="text-gray-400">
                Owned by{" "}
                <span className="text-white">{formatAddress(nft.owner)}</span>
              </div>
            </div>

            {nft.metadata?.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-gray-300">{nft.metadata.description}</p>
              </div>
            )}

            {/* Price & Actions Section */}
            <div className="border-t border-border pt-6 mt-6">
              {nft.listing && nft.listing.active ? (
                <div className="mb-6">
                  <div className="text-sm text-gray-400">Current price</div>
                  <div className="text-3xl font-bold text-white">
                    {parseFloat(nft.listing.price).toFixed(4)} BAI
                  </div>
                  {nft.owner.toLowerCase() === userAddress?.toLowerCase() ? (
                    <div className="mt-4">
                      <PepeButton variant="primary" className="w-full">
                        Cancel Listing
                      </PepeButton>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <PepeButton variant="primary" className="w-full">
                        Buy Now
                      </PepeButton>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-6">
                  <div className="text-sm text-gray-400">Status</div>
                  <div className="text-xl font-bold text-white">
                    Not for sale
                  </div>
                  {nft.owner.toLowerCase() === userAddress?.toLowerCase() && (
                    <div className="mt-4">
                      <PepeButton
                        variant="primary"
                        className="w-full"
                        onClick={() => setShowListModal(true)}
                      >
                        List for Sale
                      </PepeButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Properties Section */}
          {nft.metadata?.attributes && nft.metadata.attributes.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
              <h2 className="text-lg font-semibold mb-4">Properties</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {nft.metadata.attributes.map((attribute, index) => (
                  <div
                    key={index}
                    className="bg-background border border-border rounded-lg p-3 text-center"
                  >
                    <div className="text-xs text-primary uppercase mb-1">
                      {attribute.trait_type}
                    </div>
                    <div className="font-semibold truncate">
                      {attribute.value.toString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List for Sale Modal */}
      {showListModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6 relative backdrop-blur-sm">
            <button
              onClick={() => setShowListModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h2 className="text-2xl font-bold mb-6">List NFT for Sale</h2>

            <form onSubmit={handleListForSale}>
              <div className="mb-6">
                <label
                  htmlFor="price"
                  className="block text-sm font-medium mb-2"
                >
                  Price (BAI)
                </label>
                <input
                  type="number"
                  id="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min="0"
                  step="0.001"
                  className="w-full px-4 py-2 bg-input border border-border rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Set your price in BAI (Based AI Token)
                </p>
              </div>

              {listingError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
                  {listingError.message ||
                    "Failed to list NFT. Please try again."}
                </div>
              )}

              {isListingSuccess && (
                <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded text-green-400 text-sm">
                  <p>NFT listed successfully!</p>
                  {txHash && (
                    <p className="mt-2 text-xs break-all">
                      Transaction: {txHash}
                    </p>
                  )}
                  <p className="mt-2 text-xs">
                    The page will refresh in a few seconds to show your listing.
                  </p>
                </div>
              )}

              {!isListingSuccess && txHash && (
                <div className="mb-4 p-3 bg-blue-900/30 border border-blue-800 rounded text-blue-400 text-sm">
                  <p>Transaction submitted, waiting for confirmation...</p>
                  <p className="mt-2 text-xs break-all">
                    Transaction: {txHash}
                  </p>
                </div>
              )}

              {approvalStep && (
                <div className="mb-4 p-3 bg-blue-900/30 border border-blue-800 rounded text-blue-400 text-sm">
                  <p>Step 1/2: Approving marketplace to manage your NFT...</p>
                  {approvalTxHash && (
                    <p className="mt-2 text-xs break-all">
                      Approval Transaction: {approvalTxHash}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <PepeButton
                  variant="primary"
                  type="submit"
                  className="w-full"
                  disabled={isListing}
                >
                  {isListing ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2" />
                      {approvalStep ? "Approving..." : "Listing..."}
                    </span>
                  ) : (
                    "List for Sale"
                  )}
                </PepeButton>

                <PepeButton
                  variant="outline"
                  type="button"
                  onClick={() => setShowListModal(false)}
                  className="w-full"
                  disabled={isListing}
                >
                  Cancel
                </PepeButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
