// components/nfts/NFTBuyConfirmModal.tsx
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { NFTItem, ERC1155Item } from "@/types/contracts";
import { isERC1155Item } from "@/utils/nftTypeUtils";
import PepeButton from "@/components/ui/PepeButton";
import { formatNumberWithCommas } from "@/utils/formatting";

// Define rarity names for display
const RARITY_NAMES = ["Bronze", "Silver", "Gold", "Green"];

interface NFTBuyConfirmModalProps {
  nftItem: NFTItem | ERC1155Item;
  imageUrl: string;
  showModal: boolean;
  onClose: () => void;
  onConfirmPurchase: () => void;
  calculateUSDPrice: (price: string) => string | null;
}

const NFTBuyConfirmModal = ({
  nftItem,
  imageUrl,
  showModal,
  onClose,
  onConfirmPurchase,
  calculateUSDPrice,
}: NFTBuyConfirmModalProps) => {
  // Only render if there's a valid item with an active listing
  if (!nftItem?.listing?.active) return null;

  // Determine if the item is an ERC1155 token
  const isERC1155 = isERC1155Item(nftItem);

  // Get rarity data for ERC1155
  const rarityName =
    isERC1155 && nftItem.rarity !== undefined
      ? RARITY_NAMES[nftItem.rarity]
      : null;

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

              <div className="bg-blue-950/70 rounded-lg p-4 border border-blue-800/50 mb-4">
                <div className="text-blue-300 text-sm mb-1">Purchase price</div>
                <div className="text-white text-2xl font-bold flex items-center">
                  <span className="mr-2">
                    {formatNumberWithCommas(
                      parseInt(nftItem.listing.price).toString()
                    )}
                  </span>
                  <span className="text-blue-300">𝔹</span>
                </div>
                {calculateUSDPrice && (
                  <div className="text-blue-400 text-sm mt-1">
                    ≈ ${calculateUSDPrice(nftItem.listing.price)} USD
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
                onClick={onConfirmPurchase}
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
