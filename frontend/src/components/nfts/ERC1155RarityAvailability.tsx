// components/nfts/UpdatedRarityAvailability.tsx
import { useERC1155RarityInfo } from "@/hooks/useERC1155RarityInfo";
import PepeButton from "@/components/ui/PepeButton";
import { formatNumberWithCommas } from "@/utils/formatting";
import { useState } from "react";

interface UpdatedRarityAvailabilityProps {
  collectionAddress: string;
  onSelectRarity?: (rarityId: number) => void;
  selectedRarity?: number;
}

const UpdatedRarityAvailability = ({
  collectionAddress,
  onSelectRarity,
  selectedRarity,
}: UpdatedRarityAvailabilityProps) => {
  const { raritiesInfo, isLoading, error, refreshRarityInfo, charactersInfo } =
    useERC1155RarityInfo({
      collectionAddress,
    });

  // State for toggling character details
  // const [showCharacters, setShowCharacters] = useState(false);

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-800/30 rounded-lg text-red-300 text-sm">
        <div className="flex justify-between items-center">
          <span>{error}</span>
          <PepeButton
            variant="outline"
            className="text-xs py-1 px-2"
            onClick={refreshRarityInfo}
          >
            Retry
          </PepeButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-blue-100 font-medium">Availability by Rarity</h3>
        <div className="flex space-x-3">
          <button
            onClick={refreshRarityInfo}
            className="text-blue-400 hover:text-blue-300 transition-colors text-sm flex items-center"
            disabled={isLoading}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Rarity cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {raritiesInfo.map((rarity) => (
              <div
                key={rarity.id}
                className={`${
                  rarity.bgColorClass
                } border rounded-lg p-3 relative overflow-hidden ${
                  onSelectRarity
                    ? "cursor-pointer hover:opacity-90 transition-opacity"
                    : ""
                } ${selectedRarity === rarity.id ? "ring-2 ring-white" : ""}`}
                onClick={() =>
                  onSelectRarity &&
                  rarity.isAvailable &&
                  onSelectRarity(rarity.id)
                }
              >
                {rarity.isLoading ? (
                  <div className="absolute inset-0 bg-blue-900/50 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  !rarity.isAvailable && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-white font-bold">Not Available</div>
                    </div>
                  )
                )}

                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-white">{rarity.name}</span>
                  <span className="text-sm bg-black/30 px-2 py-0.5 rounded-full">
                    {formatNumberWithCommas(rarity.price)} 𝔹
                  </span>
                </div>

                {/* <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/80">Available:</span>
                    <span className="font-semibold text-white">
                      {formatNumberWithCommas(rarity.totalAvailable.toString())}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">Minted:</span>
                    <span className="font-semibold text-white">
                      {formatNumberWithCommas(rarity.minted.toString())} /{" "}
                      {formatNumberWithCommas(rarity.maxSupply.toString())}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">Characters:</span>
                    <span className="font-semibold text-white">
                      {rarity.availableCharacters.length}
                    </span>
                  </div>
                </div> */}

                {/* Progress bar */}
                {rarity.maxSupply > 0 && (
                  <div className="mt-2">
                    <div className="bg-black/30 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-white/70 h-full"
                        style={{
                          width: `${(rarity.minted / rarity.maxSupply) * 100}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default UpdatedRarityAvailability;
