// components/nfts/NFTListModal.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NFTItem, ERC1155Item, Collection } from "@/types/contracts";
import { isERC1155Item } from "@/utils/nftTypeUtils";
import PepeButton from "@/components/ui/PepeButton";
import { formatNumberWithCommas } from "@/utils/formatting";

interface NFTListModalProps {
  nftItem: NFTItem | ERC1155Item;
  collection: Collection | null;
  showModal: boolean;
  onClose: () => void;
  onListForSale: (e: React.FormEvent) => Promise<void>;
  price: string;
  onPriceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  quantity: number;
  onQuantityChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  approvalStep: boolean;
  approvalTxHash: string | null;
  isListing: boolean;
  isListingSuccess: boolean;
  listingJustCompleted: boolean;
  listingError: Error | null;
  txHash: string | null;
  calculateUSDPrice: (price: string) => string | null;
  usdPrice: string | null;
}

const NFTListModal = ({
  nftItem,
  collection,
  showModal,
  onClose,
  onListForSale,
  price,
  onPriceChange,
  quantity,
  onQuantityChange,
  approvalStep,
  approvalTxHash,
  isListing,
  isListingSuccess,
  listingJustCompleted,
  listingError,
  txHash,
  calculateUSDPrice,
  usdPrice,
}: NFTListModalProps) => {
  // Determine if the item is an ERC1155 token
  const isERC1155 = isERC1155Item(nftItem);

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

  // Handle quantity increment/decrement for ERC1155
  const incrementQuantity = () => {
    if (isERC1155) {
      const maxQuantity = (nftItem as ERC1155Item).balance;
      if (quantity < maxQuantity) {
        onQuantityChange({
          target: { value: (quantity + 1).toString() },
        } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      onQuantityChange({
        target: { value: (quantity - 1).toString() },
      } as React.ChangeEvent<HTMLInputElement>);
    }
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
              List {isERC1155 ? "ERC1155 Token" : "NFT"} for Sale on BasedSea
            </h2>

            <form onSubmit={onListForSale}>
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
                    onChange={onPriceChange}
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

              {/* Quantity selector for ERC1155 */}
              {isERC1155 && (
                <div className="mb-6">
                  <label
                    htmlFor="quantity"
                    className="block text-sm font-medium mb-2 text-blue-300"
                  >
                    Quantity to list (Max: {(nftItem as ERC1155Item).balance})
                  </label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={decrementQuantity}
                      className="bg-blue-800 hover:bg-blue-700 text-white rounded-l-lg p-2 transition-colors"
                      disabled={quantity <= 1}
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
                      max={(nftItem as ERC1155Item).balance}
                      value={quantity}
                      onChange={onQuantityChange}
                      className="bg-blue-950/80 text-center border-t border-b border-blue-700/50 text-blue-100 py-2 w-16 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={incrementQuantity}
                      className="bg-blue-800 hover:bg-blue-700 text-white rounded-r-lg p-2 transition-colors"
                      disabled={quantity >= (nftItem as ERC1155Item).balance}
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
              )}

              {/* Fee breakdown section */}
              {price && parseInt(price) > 0 && collection && (
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
                          This fee is used to maintain the BasedSea marketplace
                          and support ongoing development.
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
                  <p>Step 1/2: Approving marketplace to manage your NFT...</p>
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
                (isListingSuccess && nftItem?.listing?.active)) && (
                <div className="mb-4 p-3 bg-green-900/30 border border-green-800/50 rounded text-green-300 text-sm">
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
                  onClick={onClose}
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
  );
};

export default NFTListModal;
