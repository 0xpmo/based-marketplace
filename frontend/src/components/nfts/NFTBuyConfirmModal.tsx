// components/nfts/NFTBuyConfirmModal.tsx
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { NFTItem, ERC1155Item } from "@/types/contracts";
import { isERC1155Item } from "@/utils/nftTypeUtils";
import PepeButton from "@/components/ui/PepeButton";
import { formatNumberWithCommas } from "@/utils/formatting";
import { useTokenListings } from "@/hooks/useListings";
import { Listing } from "@/types/listings";

// Define rarity names for display
const RARITY_NAMES = ["Bronze", "Silver", "Gold", "Green"];

interface NFTBuyConfirmModalProps {
  nftItem: NFTItem | ERC1155Item;
  imageUrl: string;
  showModal: boolean;
  onClose: () => void;
  onConfirmPurchase: (selectedListing?: Listing) => void;
  calculateUSDPrice: (price: string) => string | null;
  quantity?: number;
  onQuantityChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const NFTBuyConfirmModal = ({
  nftItem,
  imageUrl,
  showModal,
  onClose,
  onConfirmPurchase,
  calculateUSDPrice,
  quantity = 1,
  onQuantityChange,
}: NFTBuyConfirmModalProps) => {
  // Get all active listings for this token
  const { listings } = useTokenListings(nftItem.collection, nftItem.tokenId);

  // Sort listings by price (lowest first)
  const sortedListings = [...(listings || [])].sort((a, b) => {
    const priceA = BigInt(a.price);
    const priceB = BigInt(b.price);
    return priceA < priceB ? -1 : 1;
  });

  // Get the floor listing (lowest price)
  const floorListing = sortedListings[0];

  // State for selected listing
  const [selectedListing, setSelectedListing] = useState<Listing | undefined>(
    floorListing
  );

  // Only render if there's a valid item with an active listing
  if (!floorListing) return null;

  // Determine if the item is an ERC1155 token
  const isERC1155 = isERC1155Item(nftItem);

  // Get rarity data for ERC1155
  const rarityName =
    isERC1155 && nftItem.rarity !== undefined
      ? RARITY_NAMES[nftItem.rarity]
      : null;

  // Local state for incrementing/decrementing quantity
  const incrementQuantity = () => {
    if (isERC1155 && onQuantityChange && selectedListing) {
      // Safe check for maxQty
      const maxQty = selectedListing.quantity || 1;
      if (quantity < maxQty) {
        onQuantityChange({
          target: { value: (quantity + 1).toString() },
        } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const decrementQuantity = () => {
    if (isERC1155 && onQuantityChange && quantity > 1) {
      onQuantityChange({
        target: { value: (quantity - 1).toString() },
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  // Calculate total price based on quantity
  const getTotalPrice = () => {
    if (!selectedListing) return "0";

    // The listing.price is already the price per token
    const pricePerToken = parseInt(selectedListing.price);

    // Calculate total price based on selected quantity
    return (pricePerToken * quantity).toString();
  };

  return (
    <AnimatePresence>
      {showModal && (
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
              onClick={onClose}
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
                    alt={nftItem.metadata?.name || `NFT #${nftItem.tokenId}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-blue-300 text-sm">
                    You are about to purchase
                  </p>
                  <p className="text-white font-bold text-lg">
                    {nftItem.metadata?.name || `NFT #${nftItem.tokenId}`}
                  </p>
                  {isERC1155 && rarityName && (
                    <p className="text-blue-300 text-xs mt-1">
                      {rarityName} • Token #{nftItem.tokenId}
                    </p>
                  )}
                </div>
              </div>

              {/* Listing selector for ERC1155 */}
              {isERC1155 && sortedListings.length > 1 && (
                <div className="mb-4 p-4 bg-blue-950/70 rounded-lg border border-blue-800/50">
                  <label className="block text-sm font-medium mb-2 text-blue-300">
                    Select Listing
                  </label>
                  <div className="space-y-2">
                    {sortedListings.map((listing) => (
                      <button
                        key={`${listing.seller}-${listing.price}`}
                        onClick={() => setSelectedListing(listing)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedListing === listing
                            ? "bg-blue-800/40 border-blue-500"
                            : "bg-blue-900/30 border-blue-800/30 hover:border-blue-700"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-blue-300 text-sm">Seller</div>
                            <div className="text-blue-100 font-medium">
                              {listing.seller.slice(0, 6)}...
                              {listing.seller.slice(-4)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-blue-300 text-sm">Price</div>
                            <div className="text-blue-100 font-bold">
                              𝔹 {formatNumberWithCommas(listing.price)}
                            </div>
                            <div className="text-blue-300 text-xs">
                              Available: {listing.quantity}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity selector for ERC1155 */}
              {isERC1155 && onQuantityChange && selectedListing && (
                <div className="mb-4 p-4 bg-blue-950/70 rounded-lg border border-blue-800/50">
                  <label
                    htmlFor="buy-quantity"
                    className="block text-sm font-medium mb-2 text-blue-300"
                  >
                    Quantity to Buy
                  </label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={decrementQuantity}
                      disabled={quantity <= 1}
                      className="bg-blue-700/50 hover:bg-blue-700 text-white rounded-l-lg p-2 disabled:opacity-50"
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
                          d="M20 12H4"
                        />
                      </svg>
                    </button>
                    <input
                      type="number"
                      id="buy-quantity"
                      value={quantity}
                      onChange={onQuantityChange}
                      min="1"
                      max={selectedListing.quantity || 1}
                      className="w-16 py-2 text-center bg-blue-950/80 border-y border-blue-700/50 text-blue-100"
                    />
                    <button
                      type="button"
                      onClick={incrementQuantity}
                      disabled={quantity >= (selectedListing.quantity || 1)}
                      className="bg-blue-700/50 hover:bg-blue-700 text-white rounded-r-lg p-2 disabled:opacity-50"
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
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                    <div className="ml-3 text-sm text-blue-300">
                      Available: {selectedListing.quantity || 1}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-950/70 rounded-lg p-4 border border-blue-800/50 mb-4">
                <div className="text-blue-300 text-sm mb-1">
                  {isERC1155 && quantity > 1
                    ? "Total purchase price"
                    : "Purchase price"}
                </div>
                <div className="text-white text-2xl font-bold flex items-center">
                  <span className="mr-2">
                    {formatNumberWithCommas(getTotalPrice())}
                  </span>
                  <span className="text-blue-300">𝔹</span>
                </div>
                {calculateUSDPrice && (
                  <div className="text-blue-400 text-sm mt-1">
                    ≈ ${calculateUSDPrice(getTotalPrice())} USD
                  </div>
                )}

                {isERC1155 && quantity > 1 && selectedListing && (
                  <div className="text-blue-300 text-xs mt-2 border-t border-blue-800 pt-2">
                    <div className="flex justify-between">
                      <span>Price per token:</span>
                      <span>
                        𝔹 {formatNumberWithCommas(selectedListing.price)}
                      </span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Quantity:</span>
                      <span>× {quantity}</span>
                    </div>
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
                    This action cannot be undone. Once confirmed, your purchase
                    will be processed on the blockchain.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <PepeButton
                variant="primary"
                onClick={() => onConfirmPurchase(selectedListing)}
                className="w-full ocean-pulse-animation bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
              >
                Confirm Purchase
              </PepeButton>

              <PepeButton
                variant="outline"
                onClick={onClose}
                className="w-full border-blue-500 text-blue-300 hover:bg-blue-900/30"
              >
                Cancel
              </PepeButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NFTBuyConfirmModal;
