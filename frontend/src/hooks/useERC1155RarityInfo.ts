// hooks/useERC1155RarityInfo.ts
import { useState, useEffect } from "react";
import { createPublicClient, http, formatEther } from "viem";
import { getActiveChain } from "@/config/chains";
import KekTrumpsABI from "@/contracts/KekTrumps.json";

// Define rarity names for display
export const RARITY_NAMES = ["Bronze", "Silver", "Gold", "Green"];
// Define rarity colors for styling
export const RARITY_COLORS = {
  0: "from-amber-700 to-amber-900", // Bronze
  1: "from-gray-400 to-gray-600", // Silver
  2: "from-yellow-500 to-yellow-700", // Gold
  3: "from-green-500 to-green-700", // Green
};

// Tailwind background classes for cards/buttons
export const RARITY_BG_COLORS = {
  0: "bg-amber-700/30 border-amber-600", // Bronze
  1: "bg-gray-400/30 border-gray-500", // Silver
  2: "bg-yellow-500/30 border-yellow-600", // Gold
  3: "bg-green-500/30 border-green-600", // Green
};

export interface RarityInfo {
  id: number;
  name: string;
  colorClass: string;
  bgColorClass: string;
  availableCharacters: number[];
  totalAvailable: number;
  maxSupply: number;
  minted: number;
  price: string;
  priceWei: bigint;
  isLoading: boolean;
  isAvailable: boolean;
}

interface UseERC1155RarityInfoProps {
  collectionAddress: string;
}

interface UseERC1155RarityInfoResult {
  raritiesInfo: RarityInfo[];
  isLoading: boolean;
  error: string | null;
  refreshRarityInfo: () => Promise<void>;
}

export function useERC1155RarityInfo({
  collectionAddress,
}: UseERC1155RarityInfoProps): UseERC1155RarityInfoResult {
  const [raritiesInfo, setRaritiesInfo] = useState<RarityInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRarityInfo = async () => {
    if (!collectionAddress) {
      setError("Collection address is required");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const publicClient = createPublicClient({
        chain: getActiveChain(),
        transport: http(),
      });

      // Initialize rarities info array
      const initialRaritiesInfo: RarityInfo[] = RARITY_NAMES.map(
        (name, index) => ({
          id: index,
          name,
          colorClass: RARITY_COLORS[index as keyof typeof RARITY_COLORS],
          bgColorClass:
            RARITY_BG_COLORS[index as keyof typeof RARITY_BG_COLORS],
          availableCharacters: [],
          totalAvailable: 0,
          maxSupply: 0,
          minted: 0,
          price: "0",
          priceWei: BigInt(0),
          isLoading: true,
          isAvailable: false,
        })
      );

      setRaritiesInfo(initialRaritiesInfo);

      // Check if contract is paused
      let isPaused = false;
      try {
        isPaused = (await publicClient.readContract({
          address: collectionAddress as `0x${string}`,
          abi: KekTrumpsABI.abi,
          functionName: "paused",
        })) as boolean;
      } catch (err) {
        console.warn("Failed to check if contract is paused:", err);
      }

      // Fetch data for each rarity
      const updatedRaritiesInfo = await Promise.all(
        initialRaritiesInfo.map(async (rarityInfo) => {
          try {
            // Get price
            const priceWei = (await publicClient.readContract({
              address: collectionAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "rarityPrices",
              args: [rarityInfo.id],
            })) as bigint;

            // Get available characters
            const availableCharacters = await publicClient.readContract({
              address: collectionAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "getAvailableCharactersForRarity",
              args: [rarityInfo.id],
            });

            // Calculate total available
            let totalAvailable = 0;
            let totalMinted = 0;
            let totalMaxSupply = 0;

            if (
              Array.isArray(availableCharacters) &&
              availableCharacters.length > 0
            ) {
              // For each character, get mint status (minted and maxSupply)
              for (const characterId of availableCharacters) {
                try {
                  const mintStatus = await publicClient.readContract({
                    address: collectionAddress as `0x${string}`,
                    abi: KekTrumpsABI.abi,
                    functionName: "getCharacterMintStatus",
                    args: [characterId, rarityInfo.id],
                  });

                  if (Array.isArray(mintStatus) && mintStatus.length >= 2) {
                    const minted = Number(mintStatus[0]);
                    const maxSupply = Number(mintStatus[1]);
                    const available = maxSupply - minted;

                    totalAvailable += available;
                    totalMinted += minted;
                    totalMaxSupply += maxSupply;
                  }
                } catch (err) {
                  console.error(
                    `Error getting mint status for character ${characterId}, rarity ${rarityInfo.id}:`,
                    err
                  );
                }
              }
            }

            return {
              ...rarityInfo,
              availableCharacters: Array.isArray(availableCharacters)
                ? availableCharacters.map(Number)
                : [],
              totalAvailable,
              maxSupply: totalMaxSupply,
              minted: totalMinted,
              price: priceWei ? formatEther(priceWei) : "0",
              priceWei,
              isLoading: false,
              isAvailable:
                !isPaused && priceWei > BigInt(0) && totalAvailable > 0,
            };
          } catch (err) {
            console.error(
              `Error fetching data for rarity ${rarityInfo.id}:`,
              err
            );
            return {
              ...rarityInfo,
              isLoading: false,
              isAvailable: false,
            };
          }
        })
      );

      setRaritiesInfo(updatedRaritiesInfo);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching rarity info:", err);
      setError("Failed to load rarity information");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (collectionAddress) {
      fetchRarityInfo();
    }
  }, [collectionAddress]);

  return {
    raritiesInfo,
    isLoading,
    error,
    refreshRarityInfo: fetchRarityInfo,
  };
}
