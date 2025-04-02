// components/collections/CollectionStatusBadge.tsx
import { Collection, ERC1155Collection } from "@/types/contracts";
import { isERC1155Collection } from "@/utils/collectionTypeDetector";

interface CollectionStatusBadgeProps {
  collection: Collection;
}

const CollectionStatusBadge = ({ collection }: CollectionStatusBadgeProps) => {
  const isERC1155 = isERC1155Collection(collection);

  // Determine collection status
  const isPaused = collection.mintingEnabled === false;
  const isSoldOut =
    !isERC1155 &&
    Number(collection.totalMinted) >= Number(collection.maxSupply);

  const isActive = !isPaused && !isSoldOut;

  // Set badge appearance based on status
  let badgeClass = "";
  let badgeText = "";

  if (isPaused) {
    badgeClass = "bg-yellow-600/70 border-yellow-500/50";
    badgeText = "Minting Paused";
  } else if (isSoldOut) {
    badgeClass = "bg-purple-600/70 border-purple-500/50";
    badgeText = "Sold Out";
  } else {
    badgeClass = "bg-green-600/70 border-green-500/50";
    badgeText = "Active";
  }

  return (
    <div
      className={`px-3 py-1 rounded-full text-sm font-medium ${badgeClass} border`}
    >
      {badgeText}
    </div>
  );
};

export default CollectionStatusBadge;
