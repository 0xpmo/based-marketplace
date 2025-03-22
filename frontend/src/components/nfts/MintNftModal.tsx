"use client";

import { useAccount } from "wagmi";
import { useMintNFT } from "@/hooks/useContracts";
import { Collection } from "@/types/contracts";
import PepeButton from "@/components/ui/PepeButton";

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
      // Just call mint with null tokenURI - contract will assign the next available one
      await mintNFT("", collection.mintPrice); // The smart contract handles token selection
    } catch (err) {
      console.error("Error minting NFT:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl border border-border max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
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

        <h2 className="text-2xl font-bold mb-6">Mint a Random NFT</h2>

        <div className="mb-6">
          <p className="text-gray-400 mb-2">Collection: {collection.name}</p>
          <p className="text-gray-400 mb-2">
            Price: {collection.mintPrice} BAI
          </p>
          <p className="text-gray-400 mb-2">
            Minted: {collection.totalMinted} / {collection.maxSupply}
          </p>
          <p className="text-gray-400 mb-2">
            Remaining: {collection.maxSupply - collection.totalMinted}
          </p>
        </div>

        <div className="mb-6 border border-border rounded-lg p-4 text-center">
          <div className="bg-gray-800 w-full h-40 rounded flex items-center justify-center">
            <span className="text-2xl">?</span>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Mint to reveal a random NFT from this collection!
          </p>
        </div>

        {isError && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
            {error?.message || "Failed to mint NFT. Please try again."}
          </div>
        )}

        {isSuccess && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-800 rounded text-green-400 text-sm">
            <p>NFT minted successfully!</p>
            {txHash && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-xs"
              >
                View transaction
              </a>
            )}
            <p className="mt-2 text-xs">
              The page will refresh in a few seconds to show your new NFT.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <PepeButton
            variant="primary"
            onClick={handleMint}
            disabled={
              isLoading || collection.totalMinted >= collection.maxSupply
            }
            className="w-full"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2" />
                Minting...
              </span>
            ) : (
              `Mint Random NFT for ${collection.mintPrice} BAI`
            )}
          </PepeButton>

          <PepeButton
            variant="outline"
            onClick={onClose}
            className="w-full"
            disabled={isLoading}
          >
            Cancel
          </PepeButton>
        </div>
      </div>
    </div>
  );
}
