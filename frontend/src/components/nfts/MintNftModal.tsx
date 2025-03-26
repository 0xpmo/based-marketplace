"use client";

import { useAccount } from "wagmi";
import { useMintNFT } from "@/hooks/useContracts";
import { Collection } from "@/types/contracts";
import PepeButton from "@/components/ui/PepeButton";
import { useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

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

  // Handle minting NFT - no tokenURI needed from user
  const handleMint = async () => {
    if (!address) {
      alert("Please connect your wallet first");
      return;
    }

    try {
      await mintNFT(collection.mintPrice);
    } catch (err) {
      console.error("Error minting NFT:", err);
    }
  };

  // Auto-refresh page after successful mint
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

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
            Mint Your Mystery NFT
          </span>
        </h2>

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
                {collection.totalMinted} / {collection.maxSupply}
              </span>
            </p>
            <p className="text-blue-100 flex justify-between">
              <span className="text-blue-300">Remaining:</span>
              <span className="font-semibold text-indigo-200">
                {collection.maxSupply - collection.totalMinted}
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
              <span className="font-semibold text-indigo-200">Mint now</span> to
              reveal your random NFT!
            </p>
            <p className="text-blue-300 text-xs mt-1">
              Each NFT is unique and randomly assigned
            </p>
          </div>
        </motion.div>

        {isError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-red-900/40 border border-red-500/30 rounded-lg text-red-300 text-sm shadow-lg"
          >
            <p className="font-medium mb-1">Transaction Failed</p>
            <p>{error?.message || "Failed to mint NFT. Please try again."}</p>
          </motion.div>
        )}

        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-green-900/40 border border-green-500/30 rounded-lg text-green-300 text-sm shadow-lg"
          >
            <div className="flex items-center mb-2">
              <svg
                className="w-5 h-5 mr-2 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              <p className="font-medium">NFT minted successfully!</p>
            </div>
            {txHash && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 underline text-xs flex items-center"
              >
                View transaction
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
            <p className="mt-2 text-xs">
              The page will refresh in a few seconds to show your new NFT.
            </p>
          </motion.div>
        )}

        <div className="flex flex-col gap-3 relative z-10">
          <PepeButton
            variant="primary"
            onClick={handleMint}
            disabled={
              isLoading || collection.totalMinted >= collection.maxSupply
            }
            className={`w-full ${isLoading ? "animate-pulse" : ""}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full mr-2" />
                Processing...
              </span>
            ) : collection.totalMinted >= collection.maxSupply ? (
              "Sold Out"
            ) : (
              <span className="flex items-center justify-center">
                <span className="mr-2">
                  Mint Random NFT for {collection.mintPrice} 𝔹
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
            )}
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
