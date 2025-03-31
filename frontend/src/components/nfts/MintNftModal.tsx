"use client";

import { useAccount } from "wagmi";
import { useMintNFT, useCollection } from "@/hooks/useContracts";
import { Collection, NFTItem } from "@/types/contracts";
import PepeButton from "@/components/ui/PepeButton";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getIPFSGatewayURL } from "@/services/ipfs";
import Link from "next/link";

interface MintNftModalProps {
  collection: Collection;
  onClose: () => void;
}

export default function MintNftModal({
  collection,
  onClose,
}: MintNftModalProps) {
  const { address } = useAccount();
  const { mintNFT, isLoading, isSuccess, txHash, isError, error } = useMintNFT(
    collection.address
  );
  const [hasMinted, setHasMinted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localMintedCount, setLocalMintedCount] = useState(
    collection.totalMinted
  );
  const [isRevealing, setIsRevealing] = useState(false);
  const [showLootbox, setShowLootbox] = useState(false);
  const [revealComplete, setRevealComplete] = useState(false);
  const refreshTimeout = useRef<NodeJS.Timeout | null>(null);
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null);
  const [mintedNFT, setMintedNFT] = useState<NFTItem | null>(null);
  const [isLoadingNFT, setIsLoadingNFT] = useState(false);

  // Refresh collection data to get updated minted count
  const { collection: updatedCollection, loading: loadingCollection } =
    useCollection(collection.address);

  // Update local minted count when collection data is refreshed
  useEffect(() => {
    if (updatedCollection && !loadingCollection) {
      setLocalMintedCount(updatedCollection.totalMinted);
    }
  }, [updatedCollection, loadingCollection]);

  // Find the newly minted NFT after transaction success
  const findNewlyMintedNFT = async () => {
    if (!txHash || !address) return;

    setIsLoadingNFT(true);

    try {
      // Wait a bit for blockchain to update
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // First try to get the token ID from transaction receipt
      try {
        // Get the user's owned tokens in this collection
        const response = await fetch(
          `/api/contracts/userTokens?collection=${collection.address}&owner=${address}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch tokens");
        }

        const { tokenIds } = await response.json();

        if (tokenIds && tokenIds.length > 0) {
          // Sort by token ID, assuming newest is highest number
          const sortedTokenIds = [...tokenIds].sort((a, b) => b - a);
          const latestTokenId = sortedTokenIds[0];

          // Set the minted token ID
          setMintedTokenId(latestTokenId);

          // Fetch full NFT details
          const detailsResponse = await fetch(
            `/api/contracts/tokenDetails?collection=${collection.address}&tokenId=${latestTokenId}`
          );

          if (detailsResponse.ok) {
            const tokenData = await detailsResponse.json();

            // Try to fetch metadata
            if (tokenData.tokenURI) {
              try {
                const metadataResponse = await fetch(
                  getIPFSGatewayURL(tokenData.tokenURI)
                );
                const metadata = await metadataResponse.json();
                tokenData.metadata = metadata;
              } catch (err) {
                console.error("Error fetching metadata", err);
              }
            }

            // Set the complete NFT data
            setMintedNFT(tokenData);
          }
        }
      } catch (err) {
        console.error("Error finding minted NFT:", err);
      }
    } finally {
      setIsLoadingNFT(false);
    }
  };

  // Handle minting NFT - no tokenURI needed from user
  const handleMint = async () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Reset error state
    setErrorMessage(null);

    try {
      await mintNFT(collection.mintPrice);
    } catch (err) {
      console.error("Error minting NFT:", err);

      // Handle user rejection errors
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check for wallet rejections with case-insensitive patterns
      const rejectionPatterns = [
        "user rejected",
        "user denied",
        "user cancelled",
        "rejected the request",
        "denied transaction",
        "rejected transaction",
        "metamask tx signature: user denied",
        "transaction signature: user denied",
      ];

      const isRejection = rejectionPatterns.some((pattern) =>
        errorMessage.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isRejection) {
        setErrorMessage(
          "Transaction was rejected. Please try again when you're ready to mint."
        );
        toast.error("Transaction was rejected");
      } else if (errorMessage.toLowerCase().includes("insufficient funds")) {
        setErrorMessage("You don't have enough funds to mint this NFT.");
        toast.error("Insufficient funds for transaction");
      } else {
        // For other errors, display a more user-friendly shortened message
        const shortError =
          errorMessage.length > 100
            ? errorMessage.substring(0, 100) + "..."
            : errorMessage;

        setErrorMessage(`Failed to mint NFT: ${shortError}`);
        toast.error("Failed to mint NFT");
      }
    }
  };

  // Create particle explosion effect
  const createParticles = () => {
    const container = document.getElementById("mintSuccessContainer");
    if (!container) return;

    const colors = ["#60A5FA", "#3B82F6", "#2563EB", "#BFDBFE", "#93C5FD"];
    const particleCount = 80;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div");
      const size = Math.random() * 8 + 4;

      particle.className = "absolute rounded-full";
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.backgroundColor =
        colors[Math.floor(Math.random() * colors.length)];
      particle.style.left = "50%";
      particle.style.top = "50%";

      // Random starting angle, speed and distance
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 3;
      const distance = Math.random() * 100 + 50;

      // Calculate final position
      const destinationX = Math.cos(angle) * distance;
      const destinationY = Math.sin(angle) * distance;

      // Apply animation
      particle.animate(
        [
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${destinationX}px), calc(-50% + ${destinationY}px)) scale(0)`,
            opacity: 0,
          },
        ],
        {
          duration: Math.random() * 1000 + 1000,
          easing: "cubic-bezier(0.1, 0.8, 0.2, 1)",
          fill: "forwards",
        }
      );

      container.appendChild(particle);

      // Remove particle after animation
      setTimeout(() => {
        if (container.contains(particle)) {
          container.removeChild(particle);
        }
      }, 2000);
    }
  };

  // Handle the NFT lootbox reveal animation
  const handleReveal = () => {
    setIsRevealing(true);

    // Sequence of animations
    setTimeout(() => {
      createParticles();
    }, 500);

    setTimeout(() => {
      setShowLootbox(false);
      setRevealComplete(true);
    }, 1500);

    // Schedule page refresh after user has time to see the revealed NFT
    if (refreshTimeout.current) {
      clearTimeout(refreshTimeout.current);
    }

    refreshTimeout.current = setTimeout(() => {
      window.location.reload();
    }, 15000); // Increased to 15 seconds to give user time to see and interact with the NFT
  };

  // Set minted state after successful mint
  useEffect(() => {
    if (isSuccess && !hasMinted) {
      setHasMinted(true);
      // Increment local minted count for immediate UI feedback
      setLocalMintedCount((prev) => prev + 1);
      toast.success("NFT minted successfully!");

      // Try to fetch the newly minted NFT
      findNewlyMintedNFT();

      // Show the lootbox reveal animation
      setShowLootbox(true);

      // If user doesn't interact with the reveal button, auto-reveal after 3 seconds
      const autoRevealTimer = setTimeout(() => {
        if (!isRevealing && !revealComplete) {
          handleReveal();
        }
      }, 3000);

      return () => {
        clearTimeout(autoRevealTimer);
        if (refreshTimeout.current) {
          clearTimeout(refreshTimeout.current);
        }
      };
    }
  }, [isSuccess, hasMinted, isRevealing, revealComplete, address]);

  // Make sure to clear any timeouts when component is unmounted
  useEffect(() => {
    return () => {
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
    };
  }, []);

  // Handle error state from hook
  useEffect(() => {
    if (isError && error) {
      const message = error.message || "Unknown error occurred";

      // Check for wallet rejections with case-insensitive patterns
      const rejectionPatterns = [
        "user rejected",
        "user denied",
        "user cancelled",
        "rejected the request",
        "denied transaction",
        "rejected transaction",
        "metamask tx signature: user denied",
        "transaction signature: user denied",
      ];

      const isRejection = rejectionPatterns.some((pattern) =>
        message.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isRejection) {
        setErrorMessage(
          "Transaction was rejected. Please try again when you're ready to mint."
        );
      } else if (message.toLowerCase().includes("insufficient funds")) {
        setErrorMessage("You don't have enough funds to mint this NFT.");
      } else if (message.includes("Internal JSON-RPC error")) {
        // Try to extract the revert reason
        const revertMatch = message.match(
          /reverted with reason string '(.+?)'/
        );
        const revertReason = revertMatch ? revertMatch[1] : null;

        if (revertReason) {
          setErrorMessage(`Transaction failed: ${revertReason}`);
        } else {
          setErrorMessage("Transaction failed. Please try again.");
        }
      } else {
        // For other errors, display a more user-friendly shortened message
        const shortError =
          message.length > 100 ? message.substring(0, 100) + "..." : message;

        setErrorMessage(`Error: ${shortError}`);
      }
    }
  }, [isError, error]);

  // Check if the mint button should be disabled
  const isMintButtonDisabled =
    isLoading || hasMinted || localMintedCount >= collection.maxSupply;

  // Get NFT image URL
  const getNFTImageUrl = () => {
    if (mintedNFT?.metadata?.image) {
      return getIPFSGatewayURL(mintedNFT.metadata.image);
    }
    return "/images/placeholder-nft.svg";
  };

  // Get NFT details URL
  const getNFTDetailsUrl = () => {
    if (mintedTokenId !== null) {
      return `/collections/${collection.address}/${mintedTokenId}`;
    }
    return `/collections/${collection.address}`;
  };

  // Button text based on state
  const getMintButtonText = () => {
    if (isLoading) {
      return (
        <span className="flex items-center justify-center">
          <span className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full mr-2" />
          Processing...
        </span>
      );
    } else if (hasMinted) {
      return "Minted Successfully!";
    } else if (localMintedCount >= collection.maxSupply) {
      return "Sold Out";
    } else {
      return (
        <span className="flex items-center justify-center">
          <span className="mr-2">
            Mint Random NFT for 𝔹 {formatNumberWithCommas(collection.mintPrice)}
          </span>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            ></path>
          </svg>
        </span>
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
        className="bg-gradient-to-br from-blue-950 via-indigo-900 to-blue-900 rounded-xl shadow-2xl border border-blue-500/20 max-w-md w-full p-6 relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-xl"></div>

        {/* Top particles */}
        <div className="absolute top-0 left-0 w-full h-16 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-blue-400/20 rounded-full"
              style={{
                width: `${Math.random() * 6 + 4}px`,
                height: `${Math.random() * 6 + 4}px`,
                top: `${Math.random() * 60}%`,
                left: `${Math.random() * 100}%`,
                animation: `float ${Math.random() * 10 + 10}s linear infinite`,
              }}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-blue-300 hover:text-white transition-colors z-10"
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

        <h2 className="text-3xl font-bold mb-6 text-white text-center relative">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-indigo-300">
            {revealComplete ? "Your NFT is Ready!" : "Mint Your Mystery NFT"}
          </span>
        </h2>

        {!hasMinted && (
          <>
            <div className="mb-6">
              <div className="bg-blue-900/40 p-5 rounded-lg backdrop-blur-md border border-blue-500/20 shadow-inner">
                <p className="text-blue-100 mb-3 flex justify-between">
                  <span className="text-blue-300">Collection:</span>
                  <span className="font-semibold">{collection.name}</span>
                </p>
                <p className="text-blue-100 mb-3 flex justify-between">
                  <span className="text-blue-300">Price:</span>
                  <span className="font-semibold text-indigo-200">
                    {collection.mintPrice} 𝔹
                  </span>
                </p>
                <p className="text-blue-100 mb-3 flex justify-between">
                  <span className="text-blue-300">Minted:</span>
                  <span className="font-semibold">
                    {localMintedCount} / {collection.maxSupply}
                  </span>
                </p>
                <p className="text-blue-100 flex justify-between">
                  <span className="text-blue-300">Remaining:</span>
                  <span className="font-semibold text-indigo-200">
                    {collection.maxSupply - localMintedCount}
                  </span>
                </p>
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="mb-6 border border-blue-500/30 rounded-lg p-5 text-center bg-gradient-to-b from-blue-900/60 to-indigo-900/60 shadow-lg"
            >
              <motion.div
                animate={{
                  rotate: [0, 5, 0, -5, 0],
                  y: [0, -5, 0],
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
                className="bg-gradient-to-br from-blue-800 to-indigo-900 w-full h-48 rounded-lg flex items-center justify-center shadow-inner relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[url('/images/grid-pattern.svg')] opacity-20"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-transparent"></div>

                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-indigo-200 z-10"
                >
                  ?
                </motion.div>
              </motion.div>
              <div className="mt-4 bg-blue-900/40 p-3 rounded-lg backdrop-blur-sm border border-blue-500/20">
                <p className="text-blue-100">
                  <span className="font-semibold text-indigo-200">
                    Mint now
                  </span>{" "}
                  to reveal your random NFT!
                </p>
                <p className="text-blue-300 text-xs mt-1">
                  Each NFT is unique and randomly assigned
                </p>
              </div>
            </motion.div>
          </>
        )}

        {/* Reveal Animation */}
        {showLootbox && (
          <div className="relative mb-6">
            <div
              id="mintSuccessContainer"
              className="relative w-full h-64 bg-gradient-to-br from-blue-900 to-indigo-900 rounded-xl flex items-center justify-center overflow-hidden"
            >
              <motion.div
                initial={{ scale: 0.5, rotateY: 0 }}
                animate={
                  isRevealing
                    ? { scale: [0.5, 1.1, 0], rotateY: 180, opacity: [1, 1, 0] }
                    : { scale: [0.5, 0.8, 0.7], rotateY: [0, 15, -15, 0] }
                }
                transition={
                  isRevealing
                    ? { duration: 1.5, times: [0, 0.6, 1] }
                    : { duration: 3, repeat: Infinity, repeatType: "reverse" }
                }
                className="w-40 h-40 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.7)] border-2 border-blue-300"
              >
                <span className="text-7xl">🎁</span>
              </motion.div>

              {!isRevealing && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                  className="absolute bottom-6"
                >
                  <button
                    onClick={handleReveal}
                    className="px-8 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full text-white font-bold shadow-lg border border-blue-400/40 hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition-all"
                  >
                    Reveal NFT!
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Revealed NFT */}
        {revealComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
            className="mb-6"
          >
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-white mb-4 text-center"
            >
              Congratulations! 🎉
            </motion.div>

            {/* The actual revealed NFT */}
            <div className="relative w-full aspect-square mb-4 rounded-xl overflow-hidden border-2 border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.4)]">
              {isLoadingNFT ? (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-900/70">
                  <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <Image
                  src={getNFTImageUrl()}
                  alt={mintedNFT?.metadata?.name || `NFT #${mintedTokenId}`}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/images/placeholder-nft.svg";
                  }}
                />
              )}
            </div>

            <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-4 rounded-xl border border-blue-500/30 shadow-inner mb-4">
              <p className="text-blue-100 mb-4 text-center">
                You&apos;ve successfully minted an NFT from{" "}
                <span className="font-semibold text-blue-300">
                  {collection.name}
                </span>
                !
              </p>

              {mintedNFT && (
                <div className="text-center mb-3">
                  <h3 className="text-lg font-bold text-white">
                    {mintedNFT.metadata?.name || `NFT #${mintedTokenId}`}
                  </h3>
                  {mintedNFT.metadata?.description && (
                    <p className="text-xs text-blue-300 mt-1">
                      {mintedNFT.metadata.description}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-center space-x-4 mt-2">
                {txHash && (
                  <a
                    href={`https://explorer.bf1337.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-300 hover:text-blue-200 text-sm"
                  >
                    <span>View transaction</span>
                    <svg
                      className="w-3 h-3 ml-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      ></path>
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* View NFT on Site Button */}
            <Link href={getNFTDetailsUrl()}>
              <PepeButton
                variant="primary"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border-purple-400/40"
              >
                <span className="flex items-center justify-center">
                  <span className="mr-2">View Your New NFT</span>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    ></path>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    ></path>
                  </svg>
                </span>
              </PepeButton>
            </Link>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.8] }}
              transition={{
                delay: 0.8,
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse",
              }}
              className="mt-4 text-indigo-300 text-sm text-center"
            >
              Page will refresh automatically...
            </motion.div>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm shadow-lg"
          >
            <p className="font-medium mb-1">Transaction Failed</p>
            <p>{errorMessage}</p>
          </motion.div>
        )}

        {!hasMinted && (
          <div className="flex flex-col gap-3 relative z-10">
            <PepeButton
              variant="primary"
              onClick={handleMint}
              disabled={isMintButtonDisabled}
              className={`w-full ${
                isLoading
                  ? "animate-pulse"
                  : hasMinted
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }`}
            >
              {getMintButtonText()}
            </PepeButton>

            <PepeButton
              variant="outline"
              onClick={onClose}
              className="w-full border-blue-500/30 text-blue-300 hover:bg-blue-800/30"
              disabled={isLoading}
            >
              Cancel
            </PepeButton>
          </div>
        )}
      </motion.div>

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-100px) translateX(20px);
            opacity: 0;
          }
        }
      `}</style>
    </motion.div>
  );
}

const formatNumberWithCommas = (value: number | string) => {
  // Handle null, undefined or empty string
  if (!value && value !== 0) return "0";

  // Convert to string if it's not already
  const stringValue = String(value);

  // Split by decimal point if present
  const parts = stringValue.split(".");

  // Add commas to the integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Join back with decimal part if it exists
  return parts.join(".");
};
