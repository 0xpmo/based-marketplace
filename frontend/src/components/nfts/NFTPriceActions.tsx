// components/nfts/NFTPriceActions.tsx
import { motion, AnimatePresence } from "framer-motion";
import { NFTItem, ERC1155Item } from "@/types/contracts";
import { isERC1155Item } from "@/utils/nftTypeUtils";
import PepeButton from "@/components/ui/PepeButton";
import { formatNumberWithCommas } from "@/utils/formatting";
import { useAccount } from "wagmi";
import { useTokenListings } from "@/hooks/useListings";
import { ethers } from "ethers";

const formatPrice = (priceInWei: string) => {
  return formatNumberWithCommas(ethers.formatEther(priceInWei));
};

interface NFTPriceActionsProps {
  nftItem: NFTItem | ERC1155Item;
  isOwned: boolean;
  isCancelling: boolean;
  isBuying: boolean;
  showPurchaseSuccess: boolean;
  handleCancelListing: () => void;
  handleBuyNFT: () => void;
  cancelTxHash: string | null;
  buyingTxHash: string | null;
  showMarketPrompt: boolean;
  openListModal: () => void;
  isListing: boolean;
  txHash: string | null;
  calculateUSDPrice: (price: string) => string | null;
}

const NFTPriceActions = ({
  nftItem,
  isOwned,
  isCancelling,
  isBuying,
  showPurchaseSuccess,
  handleCancelListing,
  handleBuyNFT,
  cancelTxHash,
  buyingTxHash,
  showMarketPrompt,
  openListModal,
  isListing,
  txHash,
  calculateUSDPrice,
}: NFTPriceActionsProps) => {
  const { address: userAddress } = useAccount();
  const isERC1155 = isERC1155Item(nftItem);

  // Get all active listings for this token
  const { listings, isLoading: loadingListings } = useTokenListings(
    nftItem.collection,
    nftItem.tokenId
  );

  // Sort listings by price (lowest first)
  const sortedListings = [...(listings || [])].sort((a, b) => {
    const priceA = BigInt(a.price);
    const priceB = BigInt(b.price);
    return priceA < priceB ? -1 : 1;
  });

  // Get the floor listing (lowest price)
  const floorListing = sortedListings[0];

  // Check if the current user is the seller of the floor listing
  const isFloorSeller = floorListing?.seller === userAddress;

  return (
    <div className="border-t border-blue-800/30 pt-6 mt-6">
      {floorListing ? (
        <div className="mb-6">
          <div className="text-sm text-blue-400">Floor price</div>
          <div className="text-3xl font-bold text-white flex items-center">
            <span className="mr-2">{formatPrice(floorListing.price)}</span>
            <span className="text-blue-300">𝔹</span>
          </div>
          {calculateUSDPrice && (
            <div className="text-sm text-blue-400 mt-1">
              ≈ $
              {formatNumberWithCommas(
                calculateUSDPrice(ethers.formatEther(floorListing.price)) || ""
              )}{" "}
              USD
            </div>
          )}
          {isERC1155 && floorListing.quantity && (
            <div className="text-sm text-blue-300 mt-2 border-t border-blue-800/30 pt-2">
              <div className="flex justify-between items-center">
                <span>Available for purchase:</span>
                <span className="font-medium">
                  {floorListing.quantity} tokens
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span>Price per token:</span>
                <span className="font-medium">
                  𝔹 {formatPrice(floorListing.price)}
                </span>
              </div>
            </div>
          )}
          {isFloorSeller ? (
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

          {/* For ERC1155, show supply information */}
          {isERC1155 && (
            <div className="mt-2 bg-blue-900/40 border border-blue-800/30 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-blue-300 text-sm">Total Supply:</span>
                <span className="text-blue-100 font-medium">
                  {(nftItem as ERC1155Item).supply}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-blue-300 text-sm">Your Balance:</span>
                <span className="text-blue-100 font-medium">
                  {(nftItem as ERC1155Item).balance}
                </span>
              </div>
            </div>
          )}

          {isOwned && (
            <div className="mt-4">
              <PepeButton
                variant="primary"
                className={`w-full relative overflow-hidden group ${
                  isListing || txHash
                    ? "opacity-70 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                } border-blue-500`}
                onClick={openListModal}
                disabled={isListing || txHash !== null}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/30 to-blue-400/0 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                {isListing ? "Listing in Progress..." : "List for Sale"}
              </PepeButton>
            </div>
          )}
        </div>
      )}

      {isOwned && !floorListing && showMarketPrompt && (
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
  );
};

export default NFTPriceActions;
