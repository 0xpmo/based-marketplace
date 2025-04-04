import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useState } from "react";
import { formatNumberWithCommas } from "@/utils/formatting";
import PepeButton from "@/components/ui/PepeButton";

export interface MintedNFT {
  id: number;
  rarity: string;
  imageUrl: string;
  name: string;
}

interface ERC1155MintRevealModalProps {
  showModal: boolean;
  onClose: () => void;
  mintedNFTs: MintedNFT[];
  txHash: string | null;
}

const ERC1155MintRevealModal = ({
  showModal,
  onClose,
  mintedNFTs,
  txHash,
}: ERC1155MintRevealModalProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const currentNFT = mintedNFTs[currentIndex];
  const hasMultiple = mintedNFTs.length > 1;

  const handleReveal = async () => {
    setIsRevealing(true);
    // Add a small delay for dramatic effect
    await new Promise((resolve) => setTimeout(resolve, 500));
    setRevealed(true);
    setIsRevealing(false);
  };

  const nextNFT = () => {
    setCurrentIndex((prev) => (prev + 1) % mintedNFTs.length);
  };

  const prevNFT = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + mintedNFTs.length) % mintedNFTs.length
    );
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

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-blue-100">
                {revealed ? "Congratulations! 🎉" : "Ready to Reveal? 🎁"}
              </h2>
              <p className="text-blue-300 mt-2">
                {revealed
                  ? `You got ${currentNFT.name}!`
                  : "Click to reveal your NFT!"}
              </p>
            </div>

            <div className="relative aspect-square w-full mb-6">
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={false}
                animate={
                  isRevealing
                    ? {
                        rotateY: 180,
                        transition: { duration: 0.6 },
                      }
                    : { rotateY: 0 }
                }
              >
                {!revealed ? (
                  <div className="w-full h-full bg-blue-800/30 rounded-xl border-2 border-blue-600/50 flex items-center justify-center">
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, -5, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Image
                        src="/images/mystery-box.png" // You'll need to add this asset
                        alt="Mystery Box"
                        width={200}
                        height={200}
                        className="object-contain"
                      />
                    </motion.div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="w-full h-full relative rounded-xl overflow-hidden"
                  >
                    <Image
                      src={currentNFT.imageUrl}
                      alt={currentNFT.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-900/90 to-transparent p-4">
                      <div className="text-white font-bold">
                        {currentNFT.name}
                      </div>
                      <div className="text-blue-300">{currentNFT.rarity}</div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>

            {revealed && hasMultiple && (
              <div className="flex justify-between items-center mb-6">
                <button
                  onClick={prevNFT}
                  className="p-2 text-blue-300 hover:text-white transition-colors"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="text-blue-200">
                  {currentIndex + 1} of {mintedNFTs.length}
                </div>
                <button
                  onClick={nextNFT}
                  className="p-2 text-blue-300 hover:text-white transition-colors"
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            )}

            {txHash && (
              <div className="mb-6 text-center">
                <a
                  href={`https://explorer.bf1337.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  View on Explorer ↗
                </a>
              </div>
            )}

            <div className="flex gap-3">
              {!revealed ? (
                <PepeButton
                  variant="primary"
                  onClick={handleReveal}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-blue-500"
                >
                  Reveal NFT{hasMultiple ? "s" : ""}!
                </PepeButton>
              ) : (
                <PepeButton
                  variant="outline"
                  onClick={onClose}
                  className="w-full border-blue-500 text-blue-300 hover:bg-blue-900/30"
                >
                  Close
                </PepeButton>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ERC1155MintRevealModal;
