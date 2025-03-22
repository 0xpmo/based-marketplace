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
import { motion, AnimatePresence } from "framer-motion";

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
  const [refreshing, setRefreshing] = useState(false);

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
      setRefreshing(false);
    }
  };

  useEffect(() => {
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
        fetchNFTData();
      }, 2000);
    }
  }, [isListingSuccess]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchNFTData();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <div className="bg-blue-900/30 backdrop-blur-md p-10 rounded-2xl max-w-md mx-auto border border-blue-700/30">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 relative">
              <div className="animate-ping absolute h-full w-full rounded-full bg-blue-500/30"></div>
              <div className="animate-spin h-16 w-16 border-4 border-blue-400 border-t-transparent rounded-full relative"></div>
            </div>
            <p className="text-xl font-medium text-blue-100">
              Diving into the ocean depths...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !nft) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <div className="bg-blue-900/30 border border-blue-800/30 rounded-xl shadow-lg p-8 backdrop-blur-sm">
          <h1 className="text-3xl font-bold mb-6 text-red-300">Error</h1>
          <p className="text-red-400 mb-6 max-w-md mx-auto">
            {error || "NFT not found"}
          </p>
          <Link href={`/collections/${collectionAddress}`}>
            <PepeButton
              variant="outline"
              className="border-blue-500 text-blue-300 hover:bg-blue-900/30"
            >
              Back to Collection
            </PepeButton>
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = nft.metadata?.image
    ? getIPFSGatewayURL(nft.metadata.image)
    : "/images/placeholder-nft.png";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto py-12 px-4"
      >
        {/* Breadcrumbs */}
        <nav className="flex mb-8 text-sm text-blue-300 items-center">
          <Link href="/" className="hover:text-blue-100 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/collections"
            className="hover:text-blue-100 transition-colors"
          >
            Collections
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/collections/${collectionAddress}`}
            className="hover:text-blue-100 transition-colors"
          >
            {collection?.name || "Collection"}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-white">#{tokenId}</span>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="ml-auto bg-blue-900/40 hover:bg-blue-800/40 p-2 rounded-full transition-all border border-blue-800/30"
            title="Refresh NFT data"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 ${
                refreshing ? "animate-spin text-blue-400" : "text-blue-300"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Image Section - 3 columns */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-blue-900/30 border border-blue-800/30 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 backdrop-blur-sm"
            >
              <div className="relative aspect-square w-full group">
                <Image
                  src={imageUrl}
                  alt={nft.metadata?.name || `NFT #${tokenId}`}
                  fill
                  className="object-contain transition-transform duration-500 group-hover:scale-105"
                  priority
                  sizes="(max-width: 768px) 100vw, 60vw"
                />

                {/* Animated wave overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-32 opacity-60 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none">
                  <svg
                    className="absolute bottom-0 w-full h-32"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 1200 120"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
                      fill="#1e3a8a"
                      opacity=".6"
                      className="animate-[wave_25s_ease-in-out_infinite]"
                    ></path>
                    <path
                      d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
                      fill="#1e3a8a"
                      opacity=".8"
                      className="animate-[wave_20s_ease-in-out_infinite_reverse]"
                    ></path>
                  </svg>
                </div>

                {nft.listing && nft.listing.active && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full font-bold shadow-lg">
                    For Sale
                  </div>
                )}
              </div>
            </motion.div>

            {/* Properties Section - now under image on mobile, side by side on desktop */}
            {nft.metadata?.attributes && nft.metadata.attributes.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-blue-900/30 border border-blue-800/30 rounded-xl p-6 shadow-lg mt-8 backdrop-blur-sm"
              >
                <h2 className="text-lg font-semibold mb-4 flex items-center text-blue-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  Properties
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {nft.metadata.attributes.map((attribute, index) => (
                    <motion.div
                      key={index}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 * index }}
                      className="bg-blue-950/50 border border-blue-800/30 rounded-lg p-3 text-center hover:border-blue-500/50 transition-colors"
                    >
                      <div className="text-xs text-blue-400 uppercase mb-1 font-semibold">
                        {attribute.trait_type}
                      </div>
                      <div className="font-semibold truncate text-blue-100">
                        {attribute.value.toString()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Details Section - 2 columns */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 flex flex-col"
          >
            <div className="bg-blue-900/30 border border-blue-800/30 rounded-xl p-6 shadow-lg mb-6 backdrop-blur-sm">
              <div className="flex flex-col mb-4">
                <Link
                  href={`/collections/${collectionAddress}`}
                  className="text-sm text-blue-400 hover:underline"
                >
                  {collection?.name || "Collection"}
                </Link>
                <div className="flex justify-between items-start">
                  <h1 className="text-3xl font-bold mt-1 text-white">
                    {nft.metadata?.name || `NFT #${tokenId}`}
                  </h1>
                  <div className="text-right bg-blue-950/50 p-2 rounded-lg border border-blue-800/30">
                    <div className="text-xs text-blue-400">Token ID</div>
                    <div className="font-mono text-blue-200">{tokenId}</div>
                  </div>
                </div>
              </div>

              <div className="flex mb-6 text-sm">
                <div className="flex items-center bg-blue-950/50 px-3 py-2 rounded-lg border border-blue-800/30">
                  <span className="text-blue-400 mr-2">Owned by</span>
                  <span className="text-blue-100 font-medium">
                    {formatAddress(nft.owner)}
                  </span>
                  {nft.owner.toLowerCase() === userAddress?.toLowerCase() && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                      You
                    </span>
                  )}
                </div>
              </div>

              {nft.metadata?.description && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-2 flex items-center text-blue-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Description
                  </h2>
                  <p className="text-blue-200 leading-relaxed">
                    {nft.metadata.description}
                  </p>
                </div>
              )}

              {/* Price & Actions Section */}
              <div className="border-t border-blue-800/30 pt-6 mt-6">
                {nft.listing && nft.listing.active ? (
                  <div className="mb-6">
                    <div className="text-sm text-blue-400">Current price</div>
                    <div className="text-3xl font-bold text-white flex items-center">
                      <span className="mr-2">
                        {parseFloat(nft.listing.price).toFixed(4)}
                      </span>
                      <span className="text-blue-300">BAI</span>
                    </div>
                    {nft.owner.toLowerCase() === userAddress?.toLowerCase() ? (
                      <div className="mt-4">
                        <PepeButton
                          variant="primary"
                          className="w-full ocean-pulse-animation bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                        >
                          Cancel Listing
                        </PepeButton>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <PepeButton
                          variant="primary"
                          className="w-full ocean-pulse-animation bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                        >
                          Buy Now
                        </PepeButton>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-6">
                    <div className="text-sm text-blue-400">Status</div>
                    <div className="text-xl font-bold text-blue-100 flex items-center py-2">
                      <span className="h-3 w-3 bg-gray-500 rounded-full mr-2"></span>
                      Not for sale
                    </div>
                    {nft.owner.toLowerCase() === userAddress?.toLowerCase() && (
                      <div className="mt-4">
                        <PepeButton
                          variant="primary"
                          className="w-full relative overflow-hidden group bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                          onClick={() => setShowListModal(true)}
                        >
                          <span className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/30 to-blue-400/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                          List for Sale
                        </PepeButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Activity & Details Tabs */}
            <div className="bg-blue-900/30 border border-blue-800/30 rounded-xl shadow-lg overflow-hidden backdrop-blur-sm">
              <div className="border-b border-blue-800/30 px-6 py-4">
                <h2 className="text-lg font-semibold text-blue-100">Details</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between">
                  <span className="text-blue-400">Contract Address</span>
                  <a
                    href={`https://explorer.getbased.ai/address/${collectionAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:underline truncate max-w-[200px]"
                  >
                    {formatAddress(collectionAddress)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-400">Token Standard</span>
                  <span className="text-blue-100">ERC-721</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-400">Network</span>
                  <span className="flex items-center text-blue-100">
                    <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                    Based AI
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* List for Sale Modal */}
        <AnimatePresence>
          {showListModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-blue-950/90 flex items-center justify-center z-50 p-4 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-blue-900/50 rounded-xl shadow-xl border border-blue-700/50 max-w-md w-full p-6 relative backdrop-blur-md"
              >
                <button
                  onClick={() => setShowListModal(false)}
                  className="absolute top-4 right-4 text-blue-300 hover:text-white"
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

                <h2 className="text-2xl font-bold mb-6 text-blue-100">
                  List NFT for Sale in BasedSea
                </h2>

                <form onSubmit={handleListForSale}>
                  <div className="mb-6">
                    <label
                      htmlFor="price"
                      className="block text-sm font-medium mb-2 text-blue-300"
                    >
                      Price (BAI)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        min="0"
                        step="0.001"
                        className="w-full px-4 py-2 bg-blue-950/80 border border-blue-700/50 rounded-lg text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-10"
                        required
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-blue-400 font-bold">BAI</span>
                      </div>
                    </div>
                    <p className="text-xs text-blue-400 mt-1">
                      Set your price in BAI (Based AI Token)
                    </p>
                  </div>

                  {approvalStep && (
                    <div className="mb-4 p-3 bg-blue-800/30 border border-blue-700/50 rounded text-blue-300 text-sm">
                      <p>
                        Step 1/2: Approving marketplace to manage your NFT...
                      </p>
                      {approvalTxHash && (
                        <p className="mt-2 text-xs break-all">
                          Approval Transaction: {approvalTxHash}
                        </p>
                      )}
                    </div>
                  )}

                  {listingError && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded text-red-300 text-sm">
                      {listingError.message ||
                        "Failed to list NFT. Please try again."}
                    </div>
                  )}

                  {isListingSuccess && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-800/50 rounded text-green-300 text-sm">
                      <p>NFT listed successfully!</p>
                      {txHash && (
                        <p className="mt-2 text-xs break-all">
                          Transaction: {txHash}
                        </p>
                      )}
                      <p className="mt-2 text-xs">
                        The page will refresh in a few seconds to show your
                        listing.
                      </p>
                    </div>
                  )}

                  {!isListingSuccess && txHash && (
                    <div className="mb-4 p-3 bg-blue-800/30 border border-blue-700/50 rounded text-blue-300 text-sm">
                      <p>Transaction submitted, waiting for confirmation...</p>
                      <p className="mt-2 text-xs break-all">
                        Transaction: {txHash}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <PepeButton
                      variant="primary"
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
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
                      className="w-full border-blue-500 text-blue-300 hover:bg-blue-900/30"
                      disabled={isListing}
                    >
                      Cancel
                    </PepeButton>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add a global style for the ocean pulse animation */}
        <style jsx global>{`
          .ocean-pulse-animation {
            position: relative;
            overflow: hidden;
          }
          .ocean-pulse-animation::after {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(56, 189, 248, 0.2);
            opacity: 0;
            animation: oceanPulse 2s infinite;
          }
          @keyframes oceanPulse {
            0% {
              opacity: 0;
            }
            50% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
          @keyframes wave {
            0% {
              transform: translateX(0) translateZ(0) scaleY(1);
            }
            50% {
              transform: translateX(-25%) translateZ(0) scaleY(0.8);
            }
            100% {
              transform: translateX(-50%) translateZ(0) scaleY(1);
            }
          }
        `}</style>
      </motion.div>
    </div>
  );
}
