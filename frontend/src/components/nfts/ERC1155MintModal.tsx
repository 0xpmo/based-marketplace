// components/nfts/UpdatedERC1155MintModal.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useMintERC1155 } from "@/hooks/useERC1155Contracts";
import PepeButton from "@/components/ui/PepeButton";
import { getIPFSGatewayURL } from "@/services/ipfs";
import { useTokenPrice } from "@/contexts/TokenPriceContext";
import toast from "react-hot-toast";
import { ERC1155Collection, KekTrumpsRarity } from "@/types/contracts";
import { formatNumberWithCommas } from "@/utils/formatting";
import ERC1155RarityAvailability from "./ERC1155RarityAvailability";
import {
  useERC1155RarityInfo,
  RARITY_NAMES,
  RARITY_COLORS,
} from "@/hooks/useERC1155RarityInfo";

interface UpdatedERC1155MintModalProps {
  collection: ERC1155Collection;
  onClose: () => void;
  onSuccess?: () => void;
}

const UpdatedERC1155MintModal: React.FC<UpdatedERC1155MintModalProps> = ({
  collection,
  onClose,
  onSuccess,
}) => {
  // State
  const [selectedRarity, setSelectedRarity] = useState<KekTrumpsRarity>(
    KekTrumpsRarity.Bronze
  );
  const [quantity, setQuantity] = useState(1);
  const [maxQuantity, setMaxQuantity] = useState(10);
  const [mintPrice, setMintPrice] = useState("0");
  const [totalPrice, setTotalPrice] = useState("0");
  const [imageUrl, setImageUrl] = useState<string>(
    "/images/placeholder-nft.svg"
  );
  const [activeTab, setActiveTab] = useState<KekTrumpsRarity>(
    KekTrumpsRarity.Bronze
  );
  const [imageLoading, setImageLoading] = useState(true);

  // Hooks
  const { tokenUSDRate, calculateUSDPrice } = useTokenPrice();
  const { mintERC1155, isLoading, isSuccess, isError, error, txHash } =
    useMintERC1155(collection.address);

  // Use our rarity info hook
  const { raritiesInfo, isLoading: isLoadingRarities } = useERC1155RarityInfo({
    collectionAddress: collection.address,
  });

  // Set the image URL based on collection metadata
  useEffect(() => {
    if (collection.metadata?.image) {
      setImageUrl(getIPFSGatewayURL(collection.metadata.image));
    }
  }, [collection]);

  // Update selected rarity when rarityInfo is loaded
  useEffect(() => {
    if (!isLoadingRarities && raritiesInfo.length > 0) {
      // Find the first available rarity
      const availableRarity = raritiesInfo.find((rarity) => rarity.isAvailable);
      if (availableRarity) {
        setSelectedRarity(availableRarity.id as KekTrumpsRarity);
        setActiveTab(availableRarity.id as KekTrumpsRarity);
      }
    }
  }, [isLoadingRarities, raritiesInfo]);

  // Update price when rarity changes
  useEffect(() => {
    if (!isLoadingRarities && raritiesInfo.length > 0) {
      const rarityInfo = raritiesInfo.find((r) => r.id === selectedRarity);
      if (rarityInfo) {
        setMintPrice(rarityInfo.price);

        // Update max quantity based on available supply
        const maxAvailable = rarityInfo.totalAvailable;
        const maxPerTx = collection.maxMintPerTx?.[selectedRarity] || 10;
        setMaxQuantity(Math.min(maxAvailable, maxPerTx));

        // Ensure quantity doesn't exceed max
        if (quantity > Math.min(maxAvailable, maxPerTx)) {
          setQuantity(Math.min(maxAvailable, maxPerTx) || 1);
        }
      }
    } else if (
      collection.rarityPrices &&
      selectedRarity in collection.rarityPrices
    ) {
      setMintPrice(collection.rarityPrices[selectedRarity]);

      // Update max quantity when rarity changes
      if (
        collection.maxMintPerTx &&
        selectedRarity in collection.maxMintPerTx
      ) {
        setMaxQuantity(collection.maxMintPerTx[selectedRarity]);
        // Ensure quantity doesn't exceed max
        if (quantity > collection.maxMintPerTx[selectedRarity]) {
          setQuantity(collection.maxMintPerTx[selectedRarity]);
        }
      } else {
        setMaxQuantity(10); // Default max
      }
    } else {
      setMintPrice("0");
      setMaxQuantity(10);
    }
  }, [
    selectedRarity,
    collection.rarityPrices,
    collection.maxMintPerTx,
    raritiesInfo,
    isLoadingRarities,
    quantity,
  ]);

  // Calculate total price
  useEffect(() => {
    try {
      const priceValue = parseFloat(mintPrice);
      if (!isNaN(priceValue)) {
        setTotalPrice((priceValue * quantity).toString());
      }
    } catch (e) {
      console.error("Error calculating total price:", e);
      setTotalPrice("0");
    }
  }, [mintPrice, quantity]);

  // Handle rarity selection
  const handleRarityChange = (rarity: KekTrumpsRarity) => {
    const rarityInfo = raritiesInfo.find((r) => r.id === rarity);
    if (rarityInfo && rarityInfo.isAvailable) {
      setSelectedRarity(rarity);
      setActiveTab(rarity);
    } else {
      toast.error(`${RARITY_NAMES[rarity]} rarity is not available`);
    }
  };

  // Handle quantity change
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0 && value <= maxQuantity) {
      setQuantity(value);
    }
  };

  // Handle increment/decrement buttons
  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity(quantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  // Handle mint
  const handleMint = async () => {
    const rarityInfo = raritiesInfo.find((r) => r.id === selectedRarity);
    if (!rarityInfo || !rarityInfo.isAvailable) {
      toast.error(
        `${RARITY_NAMES[selectedRarity]} rarity is not available for minting`
      );
      return;
    }

    if (quantity > rarityInfo.totalAvailable) {
      toast.error(
        `Only ${rarityInfo.totalAvailable} tokens available for this rarity`
      );
      return;
    }

    try {
      await mintERC1155(selectedRarity, quantity, mintPrice);
      toast.success(`Minting ${quantity} ${RARITY_NAMES[selectedRarity]} NFTs`);
    } catch (err) {
      console.error("Mint error:", err);
      toast.error(err instanceof Error ? err.message : "Error minting NFTs");
    }
  };

  // Format the mint price for display
  const formattedMintPrice = (price: string) => {
    try {
      return formatNumberWithCommas(price);
    } catch (e) {
      return price;
    }
  };

  // Success effect
  useEffect(() => {
    if (isSuccess && onSuccess) {
      toast.success("Minted successfully!");

      // Close modal after delay on success
      const timer = setTimeout(() => {
        onSuccess();
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, onSuccess, onClose]);

  // Check if the current rarity is available
  const isCurrentRarityAvailable = () => {
    if (isLoadingRarities) return false;
    const rarityInfo = raritiesInfo.find((r) => r.id === selectedRarity);
    return rarityInfo?.isAvailable || false;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-blue-950/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-blue-900/50 border border-blue-800/40 rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden backdrop-blur-md"
        >
          {/* Header */}
          <div className="p-6 border-b border-blue-800/40 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-blue-100">
              Mint {collection.name} NFTs
            </h2>
            <button
              onClick={onClose}
              className="text-blue-400 hover:text-blue-200 transition-colors"
              disabled={isLoading}
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
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left column - Collection Image */}
              <div>
                <div className="relative rounded-xl overflow-hidden aspect-square mb-4 border-2 border-blue-800/50">
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-950">
                      <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <Image
                    src={imageUrl}
                    alt={collection.name}
                    fill
                    className="object-cover"
                    onLoad={() => setImageLoading(false)}
                    onError={() => {
                      setImageUrl("/images/placeholder-nft.svg");
                      setImageLoading(false);
                    }}
                  />
                </div>

                <div className="text-sm text-blue-300">
                  <p className="mb-4">
                    {collection.metadata?.description ||
                      "No description available."}
                  </p>

                  <div className="bg-blue-900/50 border border-blue-800/40 rounded-lg p-4 mt-4">
                    <h3 className="font-semibold text-blue-200 mb-2">
                      Collection Details
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-blue-400">Contract</div>
                      <div className="text-blue-200 truncate">{`${collection.address.slice(
                        0,
                        6
                      )}...${collection.address.slice(-4)}`}</div>

                      <div className="text-blue-400">Characters</div>
                      <div className="text-blue-200">
                        {collection.characters?.length || 0}
                      </div>

                      <div className="text-blue-400">Royalty</div>
                      <div className="text-blue-200">
                        {(collection.royaltyFee / 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column - Mint Options */}
              <div>
                {/* Rarity Availability Section */}
                <div className="mb-6">
                  <ERC1155RarityAvailability
                    collectionAddress={collection.address}
                    onSelectRarity={handleRarityChange}
                    selectedRarity={selectedRarity}
                  />
                </div>

                {/* Rarity Selector Tabs */}
                <h3 className="text-lg font-semibold text-blue-100 mb-4">
                  Selected Rarity
                </h3>
                <div className="flex mb-6 border border-blue-800/40 rounded-lg overflow-hidden">
                  {raritiesInfo.map((rarity) => (
                    <button
                      key={rarity.id}
                      className={`flex-1 py-2 text-center text-sm font-medium transition-colors
                        ${
                          activeTab === rarity.id
                            ? `bg-gradient-to-b ${rarity.colorClass} text-white`
                            : "bg-blue-900/30 text-blue-300 hover:bg-blue-800/30"
                        } ${
                        !rarity.isAvailable
                          ? "opacity-40 cursor-not-allowed"
                          : ""
                      }`}
                      onClick={() =>
                        rarity.isAvailable &&
                        handleRarityChange(rarity.id as KekTrumpsRarity)
                      }
                      disabled={!rarity.isAvailable || isLoading}
                    >
                      {rarity.name}
                    </button>
                  ))}
                </div>

                {/* Quantity Selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-blue-300 mb-2">
                    Quantity (Max: {maxQuantity})
                  </label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={decrementQuantity}
                      disabled={
                        quantity <= 1 ||
                        isLoading ||
                        !isCurrentRarityAvailable()
                      }
                      className="bg-blue-800 hover:bg-blue-700 text-white rounded-l-lg p-2 transition-colors disabled:opacity-50"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxQuantity}
                      value={quantity}
                      onChange={handleQuantityChange}
                      disabled={isLoading || !isCurrentRarityAvailable()}
                      className="bg-blue-950 text-center border-t border-b border-blue-800/40 text-blue-100 py-2 w-16 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={incrementQuantity}
                      disabled={
                        quantity >= maxQuantity ||
                        isLoading ||
                        !isCurrentRarityAvailable()
                      }
                      className="bg-blue-800 hover:bg-blue-700 text-white rounded-r-lg p-2 transition-colors disabled:opacity-50"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Price Display */}
                <div className="bg-blue-900/50 border border-blue-800/40 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-blue-300 text-sm">Price per NFT</span>
                    <span className="text-blue-100 font-medium">
                      {formattedMintPrice(mintPrice)} 𝔹
                    </span>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className="text-blue-300 text-sm">Quantity</span>
                    <span className="text-blue-100">{quantity}</span>
                  </div>

                  <div className="border-t border-blue-800/40 pt-4 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-blue-200 font-medium">Total</span>
                      <div>
                        <div className="text-blue-100 font-bold text-xl">
                          {formattedMintPrice(totalPrice)} 𝔹
                        </div>
                        {tokenUSDRate && (
                          <div className="text-blue-400 text-xs text-right">
                            ≈ ${calculateUSDPrice(totalPrice)} USD
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error Display */}
                {isError && (
                  <div className="bg-red-900/30 border border-red-800/40 rounded-lg p-3 mb-4 text-red-300 text-sm">
                    {error instanceof Error
                      ? error.message
                      : "Failed to mint. Please try again."}
                  </div>
                )}

                {/* Success Message */}
                {isSuccess && (
                  <div className="bg-green-900/30 border border-green-800/40 rounded-lg p-3 mb-4 text-green-300 text-sm">
                    <p className="font-medium">
                      Successfully minted {quantity}{" "}
                      {RARITY_NAMES[selectedRarity]} NFTs!
                    </p>
                    {txHash && (
                      <a
                        href={`https://explorer.bf1337.org/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline text-xs block mt-1"
                      >
                        View transaction
                      </a>
                    )}
                  </div>
                )}

                {/* Mint Button */}
                <PepeButton
                  variant="primary"
                  onClick={handleMint}
                  disabled={
                    isLoading ||
                    isSuccess ||
                    !isCurrentRarityAvailable() ||
                    quantity <= 0 ||
                    quantity > maxQuantity
                  }
                  className="w-full ocean-pulse-animation bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full mr-2" />
                      Minting...
                    </span>
                  ) : isSuccess ? (
                    "Mint Successful!"
                  ) : !isCurrentRarityAvailable() ? (
                    "Not Available"
                  ) : (
                    `Mint ${quantity} ${RARITY_NAMES[selectedRarity]} NFTs`
                  )}
                </PepeButton>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UpdatedERC1155MintModal;
