// components/nfts/NFTDetailsPanel.tsx
import { NFTItem, ERC1155Item } from "@/types/contracts";
import { isERC1155Item } from "@/utils/nftTypeUtils";

// Define rarity names for display
const RARITY_NAMES = ["Bronze", "Silver", "Gold", "Green"];

interface NFTDetailsPanelProps {
  nftItem: NFTItem | ERC1155Item;
  collectionAddress: string;
  copyToClipboard: (text: string) => void;
}

const NFTDetailsPanel = ({
  nftItem,
  collectionAddress,
  copyToClipboard,
}: NFTDetailsPanelProps) => {
  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Determine if the item is an ERC1155 token
  const isERC1155 = isERC1155Item(nftItem);

  return (
    <div className="bg-blue-900/30 border border-blue-800/30 rounded-xl shadow-lg overflow-hidden backdrop-blur-sm">
      <div className="border-b border-blue-800/30 px-6 py-4">
        <h2 className="text-lg font-semibold text-blue-100">Details</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-blue-400">Contract Address</span>
          <div className="flex items-center space-x-2">
            <a
              href={`https://explorer.bf1337.org/address/${collectionAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300 hover:underline truncate max-w-[160px]"
            >
              {formatAddress(collectionAddress)}
            </a>
            <button
              onClick={() => copyToClipboard(collectionAddress)}
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
        </div>
        <div className="flex justify-between">
          <span className="text-blue-400">Token Standard</span>
          <span className="text-blue-100">
            {isERC1155 ? "ERC-1155" : "ERC-721"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-blue-400">Network</span>
          <span className="flex items-center text-blue-100">
            <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
            Based AI
          </span>
        </div>

        {/* Extra details for ERC1155 */}
        {isERC1155 && (nftItem as ERC1155Item).characterId !== undefined && (
          <div className="flex justify-between">
            <span className="text-blue-400">Character ID</span>
            <span className="text-blue-100">
              {(nftItem as ERC1155Item).characterId}
            </span>
          </div>
        )}

        {isERC1155 && (nftItem as ERC1155Item).rarity !== undefined && (
          <div className="flex justify-between">
            <span className="text-blue-400">Rarity</span>
            <span className="text-blue-100">
              {RARITY_NAMES[(nftItem as ERC1155Item).rarity!]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NFTDetailsPanel;
