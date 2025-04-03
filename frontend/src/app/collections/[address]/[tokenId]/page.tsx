// pages/collections/[address]/[tokenId].tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount, usePublicClient } from "wagmi";
import { NFTItem, ERC1155Item } from "@/types/contracts";
import { useCollection } from "@/hooks/useERC721Contracts";
import {
  useERC1155Collection,
  useERC1155Token,
} from "@/hooks/useERC1155Contracts";
import {
  useBuyNFT,
  useListNFT,
  useCancelERC1155Listing,
} from "@/hooks/useMarketplace";
import { useTokenListings } from "@/hooks/useListings";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { fetchFromIPFS } from "@/services/ipfs";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { MARKETPLACE_ADDRESS } from "@/constants/addresses";
import { getMarketplaceContract } from "@/lib/contracts";
import confetti from "canvas-confetti";
import { useTokenPrice } from "@/contexts/TokenPriceContext";
import { formatNumberWithCommas } from "@/utils/formatting";
import { isERC1155Collection } from "@/utils/collectionTypeDetector";
import { isERC1155Item, isOwnedByUser } from "@/utils/nftTypeUtils";
import { ethers } from "ethers";
import { useDeepCompareEffect } from "@/utils/deepComparison";

// Import our component parts
import NFTImageDisplay from "@/components/nfts/NFTImageDisplay";
import NFTPropertiesSection from "@/components/nfts/NFTPropertiesSection";
import NFTInfoHeader from "@/components/nfts/NFTInfoHeader";
import NFTPriceActions from "@/components/nfts/NFTPriceActions";
import NFTDetailsPanel from "@/components/nfts/NFTDetailsPanel";
import NFTBuyConfirmModal from "@/components/nfts/NFTBuyConfirmModal";
import PepeButton from "@/components/ui/PepeButton";
import NFTListModal from "@/components/nfts/NFTListModal";

export default function NFTDetailsPage() {
  const params = useParams();
  const { address: userAddress, isConnected } = useAccount();
  const collectionAddress = params.address as string;
  const tokenId = parseInt(params.tokenId as string);

  // States
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
  const [quantity, setQuantity] = useState(1);
  const publicClient = usePublicClient();

  // Use the shared token price context
  const { tokenUSDRate, calculateUSDPrice } = useTokenPrice();

  // Confetti reference
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  // Get collection data
  const { collection: erc721Collection } = useCollection(collectionAddress);
  const { collection: erc1155Collection } =
    useERC1155Collection(collectionAddress);

  // Determine if this is an ERC1155 collection
  const isERC1155 =
    isERC1155Collection(erc721Collection) ||
    isERC1155Collection(erc1155Collection);

  // Set the appropriate collection based on type
  const collection = isERC1155 ? erc1155Collection : erc721Collection;

  // Get NFT data based on type
  const [nft, setNft] = useState<NFTItem | null>(null);
  const [erc1155Token, setErc1155Token] = useState<ERC1155Item | null>(null);

  // Get ERC1155 token data if applicable
  const { token: fetchedErc1155Token, loading: loadingErc1155Token } =
    useERC1155Token(isERC1155 ? collectionAddress : "", tokenId);

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

  // Add the new hook for canceling ERC1155 listings
  const {
    cancelERC1155Listing,
    isLoading: isCancellingERC1155,
    isSuccess: isCancelERC1155Success,
    error: cancelERC1155Error,
    txHash: cancelERC1155TxHash,
  } = useCancelERC1155Listing();

  // Add the hook to fetch token listings from our database
  const {
    listings: dbListings,
    isLoading: isLoadingListings,
    refetch: refetchListings,
  } = useTokenListings(collectionAddress, tokenId);

  // Fetch NFT data
  const fetchNFTData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isERC1155) {
        // If we already have the ERC1155 token, use it
        if (fetchedErc1155Token) {
          setErc1155Token(fetchedErc1155Token);
          setLoading(false);
          return;
        }
      } else {
        // ERC721 fetch logic
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

        // Check if token is listed - use the new DB endpoint
        const listingResponse = await fetch(
          `/api/contracts/db-tokenListing?collection=${collectionAddress}&tokenId=${tokenId}`
        );

        if (listingResponse.ok) {
          const listingData = await listingResponse.json();
          data.listing = listingData.listing;
          data.allListings = listingData.allListings;
        }

        setNft(data);
      }
    } catch (err) {
      console.error("Error fetching NFT details:", err);
      setError("Failed to load NFT details. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Also fetch listings when DB listings change
  useDeepCompareEffect(() => {
    if (dbListings && dbListings.length > 0 && !isLoadingListings) {
      // Update listings in memory if the listing came from our database
      if (nft && !isERC1155) {
        // Create a deep copy of the NFT
        const updatedNft = { ...nft };

        // Find the first listing (lowest price)
        const firstListing = dbListings.sort((a, b) => {
          const priceA = BigInt(a.price);
          const priceB = BigInt(b.price);
          return priceA < priceB ? -1 : 1;
        })[0];

        // Format listing for compatibility with existing code
        updatedNft.listing = {
          price: ethers.formatEther(firstListing.price),
          seller: firstListing.seller,
          active: firstListing.status === "Active",
        };

        setNft(updatedNft);
      } else if (erc1155Token && isERC1155) {
        // Handle ERC1155 token listings
        const updatedToken = { ...erc1155Token };

        // Find the first listing (lowest price)
        const firstListing = dbListings.sort((a, b) => {
          const priceA = BigInt(a.price);
          const priceB = BigInt(b.price);
          return priceA < priceB ? -1 : 1;
        })[0];

        // Format listing for compatibility with existing code
        updatedToken.listing = {
          price: ethers.formatEther(firstListing.price),
          seller: firstListing.seller,
          active: firstListing.status === "Active",
          quantity: firstListing.quantity,
        };

        setErc1155Token(updatedToken);
      }
    }
  }, [dbListings, isLoadingListings, nft, erc1155Token, isERC1155]);

  // Effect to handle ERC1155 token data updates
  useDeepCompareEffect(() => {
    if (isERC1155 && fetchedErc1155Token && !loadingErc1155Token) {
      setErc1155Token(fetchedErc1155Token);
      setLoading(false);
    }
  }, [isERC1155, fetchedErc1155Token, loadingErc1155Token]);

  useDeepCompareEffect(() => {
    if (collectionAddress && !isNaN(tokenId)) {
      fetchNFTData();
    }
  }, [collectionAddress, tokenId]);

  // Get the active item (either ERC721 or ERC1155)
  const activeItem = isERC1155 ? erc1155Token : nft;

  // Determine ownership for either token type
  const isOwned = isOwnedByUser(activeItem, userAddress);

  // Ownership effect
  useDeepCompareEffect(() => {
    if (isOwned) {
      setTimeout(() => setShowOwnershipEffect(true), 500);
    }
  }, [nft, erc1155Token, userAddress, isOwned]);

  // Check if we should show the marketing prompt based on local storage
  useDeepCompareEffect(() => {
    if (!userAddress || !activeItem) return;

    // Don't show the market prompt if the user just purchased this NFT
    if (justPurchased) {
      setShowMarketPrompt(false);
      return;
    }

    // Only proceed if user owns the token and it's not listed
    if (isOwned && !activeItem.listing?.active) {
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
  }, [
    activeItem,
    userAddress,
    collectionAddress,
    tokenId,
    justPurchased,
    isOwned,
  ]);

  // Handle listing NFT for sale
  const handleListForSale = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!activeItem) {
      toast.error("NFT data not loaded");
      return;
    }

    if (!isOwned) {
      toast.error("You don't own this NFT");
      return;
    }

    try {
      setTxHash(null);
      setListingJustCompleted(false);

      // Determine if this is an ERC1155 token and pass the appropriate quantity
      const success = await listNFT(
        collectionAddress,
        tokenId,
        price,
        isERC1155 ? quantity : 1, // Use quantity for ERC1155, 1 for ERC721
        isERC1155
      );

      if (success) {
        setListingJustCompleted(true);
        if (listingTxHash) {
          setTxHash(listingTxHash);
        }
      }
    } catch (err) {
      console.error("Error listing for sale:", err);
    }
  };

  // Reset listing form and state when modal is opened or closed
  useDeepCompareEffect(() => {
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
  useDeepCompareEffect(() => {
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
  useDeepCompareEffect(() => {
    if (!isCancelling && cancelTxHash) {
      // If we just finished canceling, refresh to ensure all UI states are updated
      fetchNFTData();
    }
  }, [isCancelling, cancelTxHash]);

  // Effect to refresh data after successful operations
  useDeepCompareEffect(() => {
    // Refresh data after successful operations
    if (
      isListingSuccess ||
      isBuyingSuccess ||
      isCancelERC1155Success ||
      (!isCancelling && cancelTxHash) // Successful cancellation
    ) {
      // Refresh both NFT data and listings
      fetchNFTData();
      refetchListings();

      // Reset transaction hashes
      if (isListingSuccess) setTxHash(null);
      if (isCancelERC1155Success || (!isCancelling && cancelTxHash))
        setCancelTxHash(null);

      // Reset states
      if (isBuyingSuccess) {
        setShowPurchaseSuccess(true);
        setJustPurchased(true);
        setTimeout(() => {
          setShowPurchaseSuccess(false);
        }, 8000);
      }
    }
  }, [
    isListingSuccess,
    isBuyingSuccess,
    isCancelERC1155Success,
    isCancelling,
    cancelTxHash,
    fetchNFTData,
    refetchListings,
  ]);

  // Handle refresh button click
  const handleRefresh = () => {
    setRefreshing(true);
    fetchNFTData();
    refetchListings();
  };

  // Handle buying NFT
  const handleBuyNFT = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!activeItem || !activeItem.listing || !activeItem.listing.active) {
      toast.error("This NFT is not available for purchase");
      return;
    }

    // Show confirmation modal for both token types
    setShowBuyConfirmModal(true);
  };

  // Update confirmBuyNFT to handle ERC1155 purchases
  const confirmBuyNFT = async () => {
    if (!activeItem || !activeItem.listing || !activeItem.listing.active) {
      toast.error("This NFT is not available for purchase");
      setShowBuyConfirmModal(false);
      return;
    }

    try {
      setTxHash(null);
      setShowBuyConfirmModal(false); // Close the modal

      // Handle buying differently for ERC1155 tokens
      if (isERC1155) {
        // For ERC1155, we need to pass seller address and quantity
        toast.promise(
          buyNFT(
            collectionAddress,
            tokenId.toString(),
            activeItem.listing.seller, // Pass seller address for ERC1155
            activeItem.listing.price,
            quantity, // Use the selected quantity for ERC1155
            isERC1155
          ),
          {
            loading: "Initiating purchase...",
            success: "Transaction submitted! Waiting for confirmation...",
            error: "Failed to initiate purchase",
          }
        );
      } else {
        // For ERC721, use the standard approach
        toast.promise(
          buyNFT(
            collectionAddress,
            tokenId.toString(),
            activeItem.listing.seller,
            activeItem.listing.price,
            1,
            isERC1155
          ),
          {
            loading: "Initiating purchase...",
            success: "Transaction submitted! Waiting for confirmation...",
            error: "Failed to initiate purchase",
          }
        );
      }
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
    if (!confettiCanvasRef.current) return;

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
  useDeepCompareEffect(() => {
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
  useDeepCompareEffect(() => {
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

  // Update handleCancelListing to use the appropriate cancel function based on token type
  const handleCancelListing = async () => {
    if (!isConnected || !publicClient) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!activeItem || !activeItem.listing || !activeItem.listing.active) {
      toast.error("This NFT is not currently listed");
      return;
    }

    if (!isOwned) {
      toast.error("You are not the owner of this NFT");
      return;
    }

    try {
      setIsCancelling(true);
      setCancelTxHash(null);

      if (isERC1155) {
        // Use the special cancelERC1155Listing function for ERC1155 tokens
        toast.promise(cancelERC1155Listing(collectionAddress, tokenId), {
          loading: "Canceling ERC1155 listing...",
          success: "Cancellation submitted! Waiting for confirmation...",
          error: "Failed to cancel listing",
        });

        setCancelTxHash(cancelERC1155TxHash);
      } else {
        // For ERC721, use the standard cancelListing function
        // Get marketplace contract
        const marketplaceContract = await getMarketplaceContract();

        // Get the next nonce
        const nonce = await publicClient.getTransactionCount({
          address: userAddress as `0x${string}`,
          blockTag: "pending",
        });

        const tx = await marketplaceContract.cancelListing(
          collectionAddress,
          tokenId,
          process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN !== "true"
            ? {
                gasPrice: 9,
                gasLimit: 3000000,
                nonce: nonce,
              }
            : {}
        );

        setCancelTxHash(tx.hash);

        toast.success("Cancellation submitted! Waiting for confirmation...");

        // Wait for transaction to complete
        const receipt = await tx.wait();
      }

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

  // Handle quantity change for ERC1155 with proper validation
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      // For ERC1155, we should limit the quantity to the user's balance
      if (isERC1155 && erc1155Token) {
        const maxQuantity = isOwned
          ? erc1155Token.balance // If selling, limit to user's balance
          : erc1155Token.listing?.quantity || 1; // If buying, limit to listing quantity

        setQuantity(Math.min(value, maxQuantity));
      } else {
        setQuantity(value);
      }
    }
  };

  // Update USD price when price changes
  useDeepCompareEffect(() => {
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

  if (error || (!nft && !erc1155Token)) {
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

  // Get the image URL
  const imageUrl = activeItem?.metadata?.image
    ? getIPFSGatewayURL(activeItem.metadata.image)
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
          {/* Image Section - 2 columns */}
          <div className="lg:col-span-2">
            {/* NFT Image Display */}
            {activeItem && (
              <NFTImageDisplay
                nftItem={activeItem}
                imageUrl={imageUrl}
                isOwned={isOwned}
              />
            )}

            {/* NFT Properties Section */}
            {activeItem?.metadata?.attributes && (
              <NFTPropertiesSection
                attributes={activeItem.metadata.attributes}
              />
            )}
          </div>

          {/* Details Section - 3 columns */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3 flex flex-col"
          >
            <div className="bg-blue-900/30 border border-blue-800/30 rounded-xl p-6 shadow-lg mb-6 backdrop-blur-sm">
              {/* NFT Info Header */}
              {activeItem && (
                <NFTInfoHeader
                  nftItem={activeItem}
                  collectionAddress={collectionAddress}
                  collectionName={collection?.name || "Collection"}
                  isOwned={isOwned}
                  userAddress={userAddress}
                  copyToClipboard={copyToClipboard}
                />
              )}

              {/* NFT Price and Actions */}
              {activeItem && (
                <NFTPriceActions
                  nftItem={activeItem}
                  isOwned={isOwned}
                  isCancelling={isCancelling}
                  isBuying={isBuying}
                  showPurchaseSuccess={showPurchaseSuccess}
                  handleCancelListing={handleCancelListing}
                  handleBuyNFT={handleBuyNFT}
                  cancelTxHash={cancelTxHash}
                  buyingTxHash={buyingTxHash}
                  showMarketPrompt={showMarketPrompt}
                  openListModal={() => setShowListModal(true)}
                  isListing={isListing}
                  txHash={txHash}
                  calculateUSDPrice={calculateUSDPrice}
                />
              )}
            </div>

            {/* NFT Details Panel */}
            {activeItem && (
              <NFTDetailsPanel
                nftItem={activeItem}
                collectionAddress={collectionAddress}
                copyToClipboard={copyToClipboard}
              />
            )}
          </motion.div>
        </div>

        {/* NFT List Modal */}
        {activeItem && (
          <NFTListModal
            nftItem={activeItem}
            collection={collection}
            showModal={showListModal}
            onClose={() => setShowListModal(false)}
            onListForSale={handleListForSale}
            price={price}
            onPriceChange={handlePriceChange}
            quantity={quantity}
            onQuantityChange={handleQuantityChange}
            approvalStep={approvalStep}
            approvalTxHash={approvalTxHash}
            isListing={isListing}
            isListingSuccess={isListingSuccess}
            listingJustCompleted={listingJustCompleted}
            listingError={listingError}
            txHash={txHash}
            calculateUSDPrice={calculateUSDPrice}
            usdPrice={usdPrice}
          />
        )}

        {/* NFT Buy Confirmation Modal */}
        {activeItem && (
          <NFTBuyConfirmModal
            nftItem={activeItem}
            imageUrl={imageUrl}
            showModal={showBuyConfirmModal}
            onClose={() => setShowBuyConfirmModal(false)}
            onConfirmPurchase={confirmBuyNFT}
            calculateUSDPrice={calculateUSDPrice}
            quantity={quantity}
            onQuantityChange={isERC1155 ? handleQuantityChange : undefined}
          />
        )}
      </motion.div>
    </div>
  );
}
