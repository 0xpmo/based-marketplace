// components/nfts/NFTInfoHeader.tsx
import Link from "next/link";
import { motion } from "framer-motion";
import { NFTItem, ERC1155Item } from "@/types/contracts";
import { isERC1155Item } from "@/utils/nftTypeUtils";

interface NFTInfoHeaderProps {
  nftItem: NFTItem | ERC1155Item;
  collectionAddress: string;
  collectionName: string;
  isOwned: boolean;
  userAddress?: string;
  copyToClipboard: (text: string) => void;
}

const NFTInfoHeader = ({
  nftItem,
  collectionAddress,
  collectionName,
  isOwned,
  userAddress,
  copyToClipboard,
}: NFTInfoHeaderProps) => {
  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Determine if the item is an ERC1155 token
  const isERC1155 = isERC1155Item(nftItem);

  return (
    <div className="flex flex-col mb-4">
      <Link
        href={`/collections/${collectionAddress}`}
        className="text-sm text-blue-400 hover:underline"
      >
        {collectionName || "Collection"}
      </Link>
      <div className="flex justify-between items-start">
        <h1 className="text-3xl font-bold mt-1 text-white">
          {nftItem?.metadata?.name || `NFT #${nftItem.tokenId}`}
        </h1>
        <div className="text-right bg-blue-950/50 p-2 rounded-lg border border-blue-800/30">
          <div className="text-xs text-blue-400">Token ID</div>
          <div className="font-mono text-blue-200">{nftItem.tokenId}</div>
        </div>
      </div>

      <div className="flex mb-6 text-sm mt-4">
        {isERC1155 ? (
          <div className="flex items-center bg-blue-950/50 px-3 py-2 rounded-lg border border-blue-700/30">
            <span className="text-blue-400 mr-2">Owned quantity:</span>
            {isOwned ? (
              <span className="text-purple-300 font-medium flex items-center">
                <motion.div
                  animate={{ rotate: [0, 10, 0, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  💎
                </motion.div>
                <span className="ml-1">
                  {(nftItem as ERC1155Item).balance} of{" "}
                  {(nftItem as ERC1155Item).supply}
                </span>
              </span>
            ) : (
              <span className="text-blue-100 font-medium">
                0 of {(nftItem as ERC1155Item).supply || "?"}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center bg-blue-950/50 px-3 py-2 rounded-lg border border-blue-800/30">
            <span className="text-blue-400 mr-2">Owned by</span>
            {isOwned ? (
              <span className="text-purple-300 font-medium flex items-center">
                <motion.div
                  animate={{ rotate: [0, 10, 0, -10, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  💎
                </motion.div>
                <span className="ml-1">You</span>
              </span>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-blue-100 font-medium">
                  {formatAddress((nftItem as NFTItem).owner)}
                </span>
                <button
                  onClick={() => copyToClipboard((nftItem as NFTItem).owner)}
                  className="text-blue-400 hover:text-blue-200 transition-colors"
                  title="Copy address to clipboard"
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {nftItem?.metadata?.description && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center text-blue-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 text-blue-400"
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
            Description
          </h2>
          <p className="text-blue-200 leading-relaxed">
            {nftItem.metadata.description}
          </p>
        </div>
      )}
    </div>
  );
};

export default NFTInfoHeader;
