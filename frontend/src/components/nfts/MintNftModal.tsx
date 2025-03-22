"use client";

import { useState, useEffect } from "react";
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
  const [tokenURI, setTokenURI] = useState("");
  const [uploading, setUploading] = useState(false);

  // Handle NFT metadata upload to IPFS
  const handleMetadataUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    setUploading(true);

    try {
      // Create form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "name",
        `${collection.name} #${collection.totalMinted + 1}`
      );
      formData.append(
        "description",
        `An NFT from the ${collection.name} collection`
      );

      // Upload to IPFS via API route
      const response = await fetch("/api/ipfs/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.uri) {
        setTokenURI(data.uri);
      } else {
        throw new Error("Failed to get URI from upload");
      }
    } catch (err) {
      console.error("Error uploading to IPFS:", err);
      alert("Failed to upload metadata to IPFS");
    } finally {
      setUploading(false);
    }
  };

  // Handle minting NFT
  const handleMint = async () => {
    if (!address || !tokenURI || tokenURI.trim() === "") {
      alert("Please upload an image first");
      return;
    }

    try {
      await mintNFT(tokenURI, collection.mintPrice);
    } catch (err) {
      console.error("Error minting NFT:", err);
    }
  };

  // Add useEffect to refresh the page after successful minting
  useEffect(() => {
    if (isSuccess) {
      // Wait a few seconds for the transaction to be processed
      const timer = setTimeout(() => {
        window.location.reload();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isSuccess]);

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

        <h2 className="text-2xl font-bold mb-6">Mint an NFT</h2>

        <div className="mb-6">
          <p className="text-gray-400 mb-2">Collection: {collection.name}</p>
          <p className="text-gray-400 mb-2">
            Mint Price: {collection.mintPrice} BAI
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Upload NFT Image
          </label>

          {tokenURI ? (
            <div className="border border-border rounded-lg p-4 text-center">
              <p className="text-green-400 mb-2">
                ✓ Image uploaded successfully
              </p>
              <p className="text-xs text-gray-500 break-all">{tokenURI}</p>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleMetadataUpload}
                className="hidden"
                id="nft-image"
                disabled={uploading || isLoading}
              />
              <label
                htmlFor="nft-image"
                className="cursor-pointer text-gray-400 hover:text-white flex flex-col items-center"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pepe-500 mb-2" />
                    <p>Uploading to IPFS...</p>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-10 w-10 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p>Click to upload image</p>
                  </>
                )}
              </label>
            </div>
          )}
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
            disabled={!tokenURI || isLoading || uploading}
            className="w-full"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2" />
                Minting...
              </span>
            ) : (
              `Mint for ${collection.mintPrice} BAI`
            )}
          </PepeButton>

          <PepeButton
            variant="outline"
            onClick={onClose}
            className="w-full"
            disabled={isLoading || uploading}
          >
            Cancel
          </PepeButton>
        </div>
      </div>
    </div>
  );
}
