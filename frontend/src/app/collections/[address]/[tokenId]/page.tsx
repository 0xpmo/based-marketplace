"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { NFTItem } from "@/types/contracts";
import { useCollection, useBuyNFT } from "@/hooks/useContracts";
import { getIPFSGatewayURL } from "@/services/ipfs";
import PepeButton from "@/components/ui/PepeButton";
import { fetchFromIPFS } from "@/services/ipfs";
import { useListNFT } from "@/hooks/useContracts";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { MARKETPLACE_ADDRESS } from "@/constants/addresses";
import { getMarketplaceContract } from "@/lib/contracts";
import confetti from "canvas-confetti";
import { useTokenPrice } from "@/contexts/TokenPriceContext";

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
  const [price, setPrice] = useState("100000");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showOwnershipEffect, setShowOwnershipEffect] = useState(false);
  const [showPurchaseSuccess, setShowPurchaseSuccess] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelTxHash, setCancelTxHash] = useState<string | null>(null);
  const [showMarketPrompt, setShowMarketPrompt] = useState(false);
  const [listingJustCompleted, setListingJustCompleted] = useState(false);
  const [justPurchased, setJustPurchased] = useState(false);
  const [usdPrice, setUsdPrice] = useState<string | null>(null);
  const [showBuyConfirmModal, setShowBuyConfirmModal] = useState(false);
  const publicClient = usePublicClient();

  // Use the shared token price context
  const { tokenUSDRate, calculateUSDPrice, formatNumberWithCommas } =
    useTokenPrice();

  // Confetti reference
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // Buy NFT hook
  const {
    buyNFT,
    isLoading: isBuying,
    isSuccess: isBuyingSuccess,
    error: buyingError,
    txHash: buyingTxHash,
  } = useBuyNFT();

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

  useEffect(() => {
    if (nft?.owner?.toLowerCase() === userAddress?.toLowerCase()) {
      setTimeout(() => setShowOwnershipEffect(true), 500);
    }
  }, [nft, userAddress]);

  // Check if we should show the marketing prompt based on local storage
  useEffect(() => {
    if (!nft || !userAddress) return;

    // Don't show the market prompt if the user just purchased this NFT
    if (justPurchased) {
      setShowMarketPrompt(false);
      return;
    }

    // Only proceed if user is the owner and NFT is not listed
    if (
      nft.owner.toLowerCase() === userAddress.toLowerCase() &&
      !nft.listing?.active
    ) {
      const promptKey = `nft-market-prompt-${userAddress.toLowerCase()}-${collectionAddress}-${tokenId}`;
      const lastPromptTime = localStorage.getItem(promptKey);
      const viewCountKey = `nft-market-views-${userAddress.toLowerCase()}-${collectionAddress}-${tokenId}`;
      let viewCount = parseInt(localStorage.getItem(viewCountKey) || "0");

      // Increment view count
      viewCount++;
      localStorage.setItem(viewCountKey, viewCount.toString());

      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000; // One week in milliseconds

      // Show prompt if: never shown before, or last shown more than a week ago, or every 5 views
      if (
        !lastPromptTime ||
        now - parseInt(lastPromptTime) > oneWeek ||
        viewCount % 5 === 0
      ) {
        setShowMarketPrompt(true);
        // Update the last time we showed the prompt
        localStorage.setItem(promptKey, now.toString());
      } else {
        setShowMarketPrompt(false);
      }
    } else {
      setShowMarketPrompt(false);
    }
  }, [nft, userAddress, collectionAddress, tokenId, justPurchased]);

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
      setListingJustCompleted(false);
      const success = await listNFT(collectionAddress, tokenId, price);
      if (success) {
        setListingJustCompleted(true);
        // Set txHash after setting listingJustCompleted
        if (listingTxHash) {
          setTxHash(listingTxHash);
        }
      }
    } catch (err) {
      console.error("Error listing NFT:", err);
    }
  };

  // Reset listing form and state when modal is opened or closed
  useEffect(() => {
    // When the modal is opened, reset all listing-related states
    if (showListModal) {
      setTxHash(null);
      // Don't reset listingJustCompleted here to preserve success message
    } else {
      // When the modal is closed, reset success state
      setListingJustCompleted(false);

      // If there was a successful listing, refresh data
      if (isListingSuccess) {
        // We can't reset the hook's state directly, but we can force a refresh
        // which will effectively reset the UI state and fetch the latest data
        fetchNFTData();
      }
    }
  }, [showListModal, isListingSuccess]);

  // Handle success - close modal after listing with delay
  useEffect(() => {
    if (isListingSuccess) {
      // Make sure listingJustCompleted is set to true when isListingSuccess becomes true
      setListingJustCompleted(true);

      // Close the modal after a delay to show the success message
      setTimeout(() => {
        setShowListModal(false);
        // Refresh the page to show updated listing status
        fetchNFTData();
      }, 5000); // 5 seconds is enough time to see the success message
    }
  }, [isListingSuccess]);

  // Refresh UI when listing is canceled - to ensure all states are updated
  useEffect(() => {
    if (!isCancelling && cancelTxHash) {
      // If we just finished canceling, refresh to ensure all UI states are updated
      fetchNFTData();
    }
  }, [isCancelling, cancelTxHash]);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchNFTData();
  };

  // Handle buying NFT
  const handleBuyNFT = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!nft || !nft.listing || !nft.listing.active) {
      toast.error("This NFT is not available for purchase");
      return;
    }
    console.log("nft price", nft.listing.price);

    setShowBuyConfirmModal(true);

    // try {
    //   setTxHash(null);
    //   toast.promise(buyNFT(collectionAddress, tokenId, nft.listing.price), {
    //     loading: "Initiating purchase...",
    //     success: "Transaction submitted! Waiting for confirmation...",
    //     error: "Failed to initiate purchase",
    //   });
    // } catch (err) {
    //   console.error("Error buying NFT:", err);

    //   // Check for specific error messages
    //   const errorMessage = err instanceof Error ? err.message : String(err);

    //   // Check for "Item not active" error or similar patterns
    //   if (
    //     errorMessage.includes("Item not active") ||
    //     errorMessage.includes("not active") ||
    //     errorMessage.includes("not listed")
    //   ) {
    //     toast.error(
    //       "This NFT is no longer available for purchase. The listing may have been canceled."
    //     );
    //     // Refresh the NFT data to update the UI
    //     fetchNFTData();
    //   } else {
    //     toast.error(
    //       err instanceof Error
    //         ? `Error: ${err.message}`
    //         : "Failed to buy NFT. Please try again."
    //     );
    //   }
    // }
  };

  // Add a new function for the actual purchase
  const confirmBuyNFT = async () => {
    if (!nft || !nft.listing || !nft.listing.active) {
      toast.error("This NFT is not available for purchase");
      setShowBuyConfirmModal(false);
      return;
    }
    try {
      setTxHash(null);
      setShowBuyConfirmModal(false); // Close the modal

      toast.promise(buyNFT(collectionAddress, tokenId, nft.listing.price), {
        loading: "Initiating purchase...",
        success: "Transaction submitted! Waiting for confirmation...",
        error: "Failed to initiate purchase",
      });
    } catch (err) {
      console.error("Error buying NFT:", err);

      // Check for specific error messages
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check for "Item not active" error or similar patterns
      if (
        errorMessage.includes("Item not active") ||
        errorMessage.includes("not active") ||
        errorMessage.includes("not listed")
      ) {
        toast.error(
          "This NFT is no longer available for purchase. The listing may have been canceled."
        );
        // Refresh the NFT data to update the UI
        fetchNFTData();
      } else {
        toast.error(
          err instanceof Error
            ? `Error: ${err.message}`
            : "Failed to buy NFT. Please try again."
        );
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success("Address copied to clipboard");
      })
      .catch((err) => {
        console.error("Failed to copy address: ", err);
        toast.error("Failed to copy address");
      });
  };

  // Function to trigger confetti explosion
  const triggerConfetti = () => {
    const duration = 8 * 1000;
    const animationEnd = Date.now() + duration;

    // Create intense confetti explosion
    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      // Launch confetti from sides
      confetti({
        particleCount: 3,
        angle: randomInRange(45, 65),
        spread: randomInRange(50, 70),
        origin: { x: 0, y: 0.6 },
        colors: [
          "#5D5FEF",
          "#2563EB",
          "#3B82F6",
          "#60A5FA",
          "#93C5FD",
          "#BFDBFE",
        ],
      });

      confetti({
        particleCount: 3,
        angle: randomInRange(115, 135),
        spread: randomInRange(50, 70),
        origin: { x: 1, y: 0.6 },
        colors: [
          "#5D5FEF",
          "#2563EB",
          "#3B82F6",
          "#60A5FA",
          "#93C5FD",
          "#BFDBFE",
        ],
      });
    }, 200);

    // Initial burst
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
    });
  };

  // Handle buy success
  useEffect(() => {
    if (isBuyingSuccess) {
      setShowPurchaseSuccess(true);
      setJustPurchased(true);

      // Trigger confetti
      triggerConfetti();

      // Refresh the NFT data to show updated ownership
      setTimeout(() => {
        fetchNFTData();
        // Hide the success animation after a longer time
        setTimeout(() => {
          setShowPurchaseSuccess(false);

          // Reset the justPurchased flag after a day
          setTimeout(() => {
            setJustPurchased(false);
          }, 24 * 60 * 60 * 1000); // 24 hours
        }, 8000); // Increased from 5000 to 8000 ms
      }, 2000);
    }
  }, [isBuyingSuccess]);

  // Handle buy error - updated to handle RPC errors with custom messages
  useEffect(() => {
    if (buyingError) {
      const errorMessage = buyingError.message || "Unknown error";

      // Check for common blockchain error patterns in RPC errors
      if (errorMessage.includes("Internal JSON-RPC error")) {
        // Try to extract the revert reason if available
        const revertMatch = errorMessage.match(
          /reverted with reason string '(.+?)'/
        );
        const revertReason = revertMatch ? revertMatch[1] : null;

        if (revertReason === "Item not active") {
          toast.error(
            "This NFT is no longer available for purchase. The listing may have been canceled."
          );
          // Refresh the NFT data automatically
          fetchNFTData();
        } else if (revertReason) {
          toast.error(`Transaction failed: ${revertReason}`);
        } else {
          toast.error(
            "Transaction failed. The NFT may no longer be available for purchase."
          );
        }
      } else {
        toast.error(`Transaction failed: ${errorMessage}`);
      }
    }
  }, [buyingError]);

  // Handle cancel listing
  const handleCancelListing = async () => {
    if (!isConnected || !publicClient) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!nft || !nft.listing || !nft.listing.active) {
      toast.error("This NFT is not currently listed");
      return;
    }

    if (nft.owner.toLowerCase() !== userAddress?.toLowerCase()) {
      toast.error("You are not the owner of this NFT");
      return;
    }

    try {
      setIsCancelling(true);
      setCancelTxHash(null);

      // Get marketplace contract
      const marketplaceContract = await getMarketplaceContract();

      // Get the next nonce
      const nonce = await publicClient.getTransactionCount({
        address: userAddress,
        blockTag: "pending",
      });

      // Call the cancelListing function
      const tx = await marketplaceContract.cancelListing(
        collectionAddress,
        tokenId,
        {
          gasPrice: 9,
          gasLimit: 3000000,
          nonce: nonce, // Use the nonce from publicClient
        }
      );

      setCancelTxHash(tx.hash);

      toast.success("Cancellation submitted! Waiting for confirmation...");

      // Wait for transaction to complete
      const receipt = await tx.wait();

      // Refresh the NFT data to show updated listing status
      toast.success("Listing cancelled successfully!");
      fetchNFTData();
    } catch (err) {
      console.error("Error cancelling listing:", err);
      toast.error(
        err instanceof Error
          ? `Error: ${err.message}`
          : "Failed to cancel listing. Please try again."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle price input with integer-only validation
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove any non-numeric characters (including decimal points)
    const value = e.target.value.replace(/[^0-9]/g, "");

    // Validate that it's a proper number
    if (value === "" || !isNaN(parseInt(value))) {
      setPrice(value);
    }
  };

  // Format price for display, but keep the raw value for calculations
  const getFormattedPrice = () => {
    if (!price) return "";

    // Format the price for display as an integer
    try {
      const numValue = parseInt(price);
      if (isNaN(numValue)) return price;
      return price;
    } catch (e) {
      return price;
    }
  };

  // Update USD price when price changes
  useEffect(() => {
    if (tokenUSDRate && price) {
      const usdValue = calculateUSDPrice(price);
      setUsdPrice(usdValue);
    }
  }, [price, tokenUSDRate, calculateUSDPrice]);

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
    : "/images/placeholder-nft.svg";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-950 to-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto py-12 px-4"
      >
        {/* Canvas for confetti (positioned fixed to cover the whole screen) */}
        <canvas
          ref={confettiCanvasRef}
          className="fixed inset-0 pointer-events-none z-50"
          style={{ width: "100vw", height: "100vh" }}
        />

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
          <div className="lg:col-span-2">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`bg-blue-900/30 border border-blue-800/30 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 backdrop-blur-sm relative
                ${
                  nft.owner.toLowerCase() === userAddress?.toLowerCase()
                    ? "ring-4 ring-purple-500/30"
                    : ""
                }`}
            >
              {/* Ownership badge - only shown for owners */}
              <div className="relative aspect-square w-full group">
                <Image
                  src={imageUrl}
                  alt={nft.metadata?.name || `NFT #${tokenId}`}
                  fill
                  className="object-contain transition-transform duration-500 group-hover:scale-105"
                  priority
                  onError={(e) => {
                    e.currentTarget.src = "/images/placeholder-nft.svg";
                  }}
                />

                {/* Animated wave overlay */}
                {/* <div className="absolute bottom-0 left-0 right-0 h-32 opacity-60 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none">
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
                </div> */}

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
                {nft.owner.toLowerCase() === userAddress?.toLowerCase() ? (
                  <div className="flex items-center bg-blue-950/50 px-3 py-2 rounded-lg border border-blue-700/30">
                    <span className="text-blue-400 mr-2">Owned by</span>
                    <span className="text-purple-300 font-medium flex items-center">
                      <motion.div
                        animate={{ rotate: [0, 10, 0, -10, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        💎
                      </motion.div>
                      <span className="ml-1">You</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center bg-blue-950/50 px-3 py-2 rounded-lg border border-blue-800/30">
                    <span className="text-blue-400 mr-2">Owned by</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-100 font-medium">
                        {formatAddress(nft.owner)}
                      </span>
                      <button
                        onClick={() => copyToClipboard(nft.owner)}
                        className="text-blue-400 hover:text-blue-200 transition-colors"
                        title="Copy address to clipboard"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
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
                        {formatNumberWithCommas(
                          parseInt(nft.listing.price).toString()
                        )}
                      </span>
                      <span className="text-blue-300">𝔹</span>
                    </div>
                    {tokenUSDRate && (
                      <div className="text-sm text-blue-400 mt-1">
                        ≈ $
                        {formatNumberWithCommas(
                          calculateUSDPrice(nft.listing.price) || ""
                        )}{" "}
                        USD
                      </div>
                    )}
                    {nft.owner.toLowerCase() === userAddress?.toLowerCase() ? (
                      <div className="mt-4">
                        <PepeButton
                          variant="primary"
                          className="w-full ocean-pulse-animation bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                          onClick={handleCancelListing}
                          disabled={isCancelling}
                        >
                          {isCancelling ? "Cancelling..." : "Cancel Listing"}
                        </PepeButton>

                        {/* Transaction Hash Link */}
                        {cancelTxHash && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 text-xs text-center text-blue-300"
                          >
                            <a
                              href={`https://explorer.bf1337.org/tx/${cancelTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-200 hover:underline"
                            >
                              View transaction on explorer
                            </a>
                          </motion.div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 relative">
                        <PepeButton
                          variant="primary"
                          className="w-full ocean-pulse-animation bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                          onClick={handleBuyNFT}
                          disabled={isBuying}
                        >
                          {isBuying ? "Processing..." : "Buy Now"}
                        </PepeButton>

                        {/* Purchase success animation overlay */}
                        <AnimatePresence>
                          {showPurchaseSuccess && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{
                                opacity: 0,
                                scale: 0.8,
                                transition: { duration: 0.5 },
                              }}
                              className="absolute inset-0 flex items-center justify-center"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/70 to-blue-600/70 rounded-lg backdrop-blur-sm z-10"></div>
                              <div className="relative z-20 flex flex-col items-center">
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: [0, 1.2, 1] }}
                                  transition={{
                                    duration: 0.5,
                                    times: [0, 0.8, 1],
                                  }}
                                  className="text-4xl mb-2"
                                >
                                  🎉
                                </motion.div>
                                <motion.div
                                  initial={{ y: 10, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  transition={{ delay: 0.3 }}
                                  className="text-white font-bold text-xl text-center"
                                >
                                  Purchased Successfully!
                                </motion.div>
                                <motion.div
                                  initial={{ scale: 0.5, opacity: 0 }}
                                  animate={{
                                    scale: 1,
                                    opacity: 1,
                                    rotate: [0, 10, 0, -10, 0],
                                  }}
                                  transition={{
                                    delay: 0.5,
                                    rotate: {
                                      repeat: Infinity,
                                      duration: 1.5,
                                      ease: "easeInOut",
                                    },
                                  }}
                                  className="text-3xl mt-2"
                                >
                                  💎
                                </motion.div>
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 1 }}
                                  className="mt-4 text-blue-100 text-center text-sm"
                                >
                                  This NFT is now yours!
                                </motion.div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Transaction Hash Link */}
                        {buyingTxHash && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-2 text-xs text-center text-blue-300"
                          >
                            <a
                              href={`https://explorer.bf1337.org/tx/${buyingTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-blue-200 hover:underline"
                            >
                              View transaction on explorer
                            </a>
                          </motion.div>
                        )}
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
                          className={`w-full relative overflow-hidden group ${
                            isListing || txHash
                              ? "opacity-70 cursor-not-allowed"
                              : "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                          } border-blue-500`}
                          onClick={() => setShowListModal(true)}
                          disabled={isListing || txHash !== null}
                        >
                          <span className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/30 to-blue-400/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                          {isListing
                            ? "Listing in Progress..."
                            : "List for Sale"}
                        </PepeButton>
                      </div>
                    )}
                  </div>
                )}

                {nft.owner.toLowerCase() === userAddress?.toLowerCase() &&
                  !nft.listing?.active &&
                  showMarketPrompt && (
                    <motion.div
                      className="mb-6 bg-gradient-to-r from-purple-900/40 via-indigo-900/40 to-blue-900/40 p-4 rounded-lg border border-purple-500/30 shadow-lg overflow-hidden relative"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      {/* Animated background effect */}
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/10 to-purple-500/0"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          repeatType: "loop",
                        }}
                      />

                      <div className="flex items-center space-x-3 relative z-10">
                        <div className="bg-purple-600/70 p-2 rounded-full flex-shrink-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-purple-200 font-medium">
                            Ready to put this NFT on the market?
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
              </div>
            </div>

            {/* Activity & Details Tabs */}
            <div className="bg-blue-900/30 border border-blue-800/30 rounded-xl shadow-lg overflow-hidden backdrop-blur-sm">
              <div className="border-b border-blue-800/30 px-6 py-4">
                <h2 className="text-lg font-semibold text-blue-100">Details</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-blue-400">Contract Address</span>
                  <div className="flex items-center space-x-2">
                    <a
                      href={`https://explorer.bf1337.org/address/${collectionAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:underline truncate max-w-[160px]"
                    >
                      {formatAddress(collectionAddress)}
                    </a>
                    <button
                      onClick={() => copyToClipboard(collectionAddress)}
                      className="text-blue-400 hover:text-blue-200 transition-colors"
                      title="Copy address to clipboard"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
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
                  List NFT for Sale on BasedSea
                </h2>

                <form onSubmit={handleListForSale}>
                  <div className="mb-6">
                    <label
                      htmlFor="price"
                      className="block text-sm font-medium mb-2 text-blue-300"
                    >
                      Price (𝔹)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="price"
                        value={getFormattedPrice()}
                        onChange={handlePriceChange}
                        placeholder="10000"
                        className="w-full px-4 py-2 bg-blue-950/80 border border-blue-700/50 rounded-lg text-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-10"
                        required
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-blue-400 font-bold">𝔹</span>
                      </div>
                    </div>
                    <p className="text-xs text-blue-400 mt-1">
                      Set your price in 𝔹
                      {usdPrice && (
                        <span className="ml-1">(≈ ${usdPrice} USD)</span>
                      )}
                    </p>
                    {price && parseInt(price) > 0 && (
                      <p className="text-sm mt-2 text-blue-200">
                        Displayed to buyers:{" "}
                        <span className="font-semibold">
                          𝔹 {formatNumberWithCommas(price)}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Fee breakdown section */}
                  {price && parseInt(price) > 0 && (
                    <div className="mb-6 p-4 bg-blue-800/20 border border-blue-700/30 rounded-lg">
                      <h3 className="text-blue-100 font-medium mb-3">
                        Fee Breakdown
                      </h3>

                      {/* Creator royalty - assuming this exists in collection data */}
                      {collection?.royaltyFee &&
                      Number(collection.royaltyFee) > 0 ? (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-blue-300 text-sm">
                            Creator Royalty (
                            {(Number(collection.royaltyFee) / 100).toFixed(2)}%)
                          </span>
                          <span className="text-blue-200 text-sm">
                            𝔹{" "}
                            {formatNumberWithCommas(
                              (
                                parseInt(price) *
                                (Number(collection.royaltyFee) / 10000)
                              ).toFixed(0)
                            )}
                          </span>
                        </div>
                      ) : null}

                      {/* Marketplace fee */}
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center">
                          <span className="text-blue-300 text-sm">
                            Marketplace Fee (4.5%)
                          </span>
                          <div className="relative ml-1 group">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-4 w-4 text-blue-400"
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
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 rounded shadow-lg text-xs text-blue-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                              This fee is used to maintain the BasedSea
                              marketplace and support ongoing development.
                            </div>
                          </div>
                        </div>
                        <span className="text-blue-200 text-sm">
                          𝔹{" "}
                          {formatNumberWithCommas(
                            (parseInt(price) * 0.045).toFixed(0)
                          )}
                        </span>
                      </div>

                      {/* Divider line */}
                      <div className="border-t border-blue-700/30 my-3"></div>

                      {/* Total payout calculation */}
                      <div className="flex justify-between items-center">
                        <span className="text-blue-100 font-medium">
                          Your payout
                        </span>
                        <span className="text-blue-100 font-medium">
                          𝔹{" "}
                          {formatNumberWithCommas(
                            (
                              parseInt(price) -
                              parseInt(price) * 0.045 -
                              (collection?.royaltyFee
                                ? parseInt(price) *
                                  (Number(collection.royaltyFee) / 10000)
                                : 0)
                            ).toFixed(0)
                          )}
                        </span>
                      </div>

                      {/* USD equivalent if available */}
                      {usdPrice && (
                        <div className="flex justify-end mt-1">
                          <span className="text-blue-400 text-xs">
                            ≈ $
                            {calculateUSDPrice(
                              (
                                parseInt(price) -
                                parseInt(price) * 0.045 -
                                (collection?.royaltyFee
                                  ? parseInt(price) *
                                    (Number(collection.royaltyFee) / 10000)
                                  : 0)
                              ).toFixed(0)
                            )}{" "}
                            USD
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add information notice about how listing works */}
                  <div className="mb-6 p-3 bg-blue-800/20 border border-blue-700/30 rounded-lg text-blue-200 text-sm">
                    <p className="flex items-center">
                      <span className="h-4 w-4 mr-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-2 text-blue-400"
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
                      </span>
                      When you list an NFT, it remains in your wallet. The
                      marketplace is only authorized to transfer it when sold.
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

                  {/* Show success message if either:
                      1. Listing was just completed in this session OR
                      2. The NFT is currently listed and we have a listing success status */}
                  {(listingJustCompleted ||
                    (isListingSuccess && nft?.listing?.active)) && (
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

                  {!isListingSuccess && !listingJustCompleted && txHash && (
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
                      className={`w-full ${
                        isListing || isListingSuccess || listingJustCompleted
                          ? "bg-blue-800/50 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                      } border-blue-500`}
                      disabled={
                        isListing || isListingSuccess || listingJustCompleted
                      }
                    >
                      {isListing ? (
                        <span className="flex items-center justify-center">
                          <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2" />
                          {approvalStep ? "Approving..." : "Listing..."}
                        </span>
                      ) : isListingSuccess || listingJustCompleted ? (
                        "Listed Successfully"
                      ) : (
                        "List for Sale"
                      )}
                    </PepeButton>

                    <PepeButton
                      variant="outline"
                      type="button"
                      onClick={() => setShowListModal(false)}
                      className="w-full border-blue-500 text-blue-300 hover:bg-blue-900/30"
                      disabled={
                        isListing || isListingSuccess || listingJustCompleted
                      }
                    >
                      {isListingSuccess || listingJustCompleted
                        ? "Close"
                        : "Cancel"}
                    </PepeButton>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showBuyConfirmModal && nft?.listing && (
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
                  onClick={() => setShowBuyConfirmModal(false)}
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
                  Confirm Purchase
                </h2>

                <div className="mb-6">
                  <div className="flex items-center mb-4">
                    <div className="w-20 h-20 relative overflow-hidden rounded-lg mr-4 border border-blue-700/50">
                      <Image
                        src={imageUrl}
                        alt={nft.metadata?.name || `NFT #${tokenId}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-blue-300 text-sm">
                        You are about to purchase
                      </p>
                      <p className="text-white font-bold text-lg">
                        {nft.metadata?.name || `NFT #${tokenId}`}
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-950/70 rounded-lg p-4 border border-blue-800/50 mb-4">
                    <div className="text-blue-300 text-sm mb-1">
                      Purchase price
                    </div>
                    <div className="text-white text-2xl font-bold flex items-center">
                      <span className="mr-2">
                        {formatNumberWithCommas(
                          parseInt(nft.listing.price).toString()
                        )}
                      </span>
                      <span className="text-blue-300">𝔹</span>
                    </div>
                    {tokenUSDRate && (
                      <div className="text-blue-400 text-sm mt-1">
                        ≈ ${calculateUSDPrice(nft.listing.price)} USD
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-800/20 border border-blue-700/30 rounded-lg p-3 text-blue-200 text-sm mb-6">
                    <div className="flex items-start">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-blue-400 flex-shrink-0 mt-0.5"
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
                      <span>
                        This action cannot be undone. Once confirmed, your
                        purchase will be processed on the blockchain.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <PepeButton
                    variant="primary"
                    onClick={confirmBuyNFT}
                    className="w-full ocean-pulse-animation bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                    disabled={isBuying}
                  >
                    {isBuying ? "Processing..." : "Confirm Purchase"}
                  </PepeButton>

                  <PepeButton
                    variant="outline"
                    onClick={() => setShowBuyConfirmModal(false)}
                    className="w-full border-blue-500 text-blue-300 hover:bg-blue-900/30"
                  >
                    Cancel
                  </PepeButton>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
