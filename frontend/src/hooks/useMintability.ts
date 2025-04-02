// hooks/useMintability.ts
import { useState, useEffect } from "react";
import { Collection, ERC1155Collection } from "@/types/contracts";
import { isERC1155Collection } from "@/utils/collectionTypeDetector";
import {
  isCollectionPaused,
  isCollectionSoldOut,
} from "@/utils/collectionStateUtils";
import { createPublicClient, http } from "viem";
import { getActiveChain } from "@/config/chains";
import KekTrumpsABI from "@/contracts/KekTrumps.json";

// Cache for mintability results to avoid repeated checks
const mintabilityCache: {
  [key: string]: {
    timestamp: number;
    isMintable: boolean;
  };
} = {};
const CACHE_TTL = 60 * 1000; // 1 minute

export function useMintability(collection: Collection | null) {
  const [isMintable, setIsMintable] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Checking...");

  useEffect(() => {
    // Reset states when collection changes
    setIsChecking(true);

    // First set a synchronous initial state for better UI responsiveness
    if (!collection) {
      setIsMintable(false);
      setStatusText("Error fetching collection (refresh please)");
      setIsChecking(false);
      return;
    }

    // Check if paused
    if (isCollectionPaused(collection)) {
      setIsMintable(false);
      setStatusText("Minting Paused");
      setIsChecking(false);
      return;
    }

    // For ERC721, we can determine instantly
    if (!isERC1155Collection(collection)) {
      const soldOut = isCollectionSoldOut(collection);
      setIsMintable(!soldOut);
      setStatusText(soldOut ? "Sold Out" : "Available");
      setIsChecking(false);
      return;
    }

    // For ERC1155, check cache first
    const cacheKey = collection.address;
    const cacheEntry = mintabilityCache[cacheKey];
    if (cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_TTL) {
      setIsMintable(cacheEntry.isMintable);
      setStatusText(cacheEntry.isMintable ? "Available" : "Sold Out");
      setIsChecking(false);
      return;
    }

    // Then do a direct check with the contract
    const checkERC1155Mintability = async () => {
      try {
        const publicClient = createPublicClient({
          chain: getActiveChain(),
          transport: http(),
        });

        // Before checking character availability, check if contract is paused
        try {
          const isPaused = await publicClient.readContract({
            address: collection.address as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "paused",
          });

          if (isPaused) {
            setIsMintable(false);
            setStatusText("Minting Paused");
            // Update cache
            mintabilityCache[cacheKey] = {
              timestamp: Date.now(),
              isMintable: false,
            };
            return;
          }
        } catch (pauseError) {
          console.warn("Could not check pause status:", pauseError);
          // Continue to check availability
        }

        // Now check all rarities (0-3) to see if any have available tokens
        let anyAvailable = false;

        // Check all rarities (Bronze, Silver, Gold, Green)
        for (let rarityIndex = 0; rarityIndex <= 3; rarityIndex++) {
          try {
            const availableCharacters = await publicClient.readContract({
              address: collection.address as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "getAvailableCharactersForRarity",
              args: [rarityIndex],
            });

            // If any characters are available for this rarity, tokens can be minted
            if (
              Array.isArray(availableCharacters) &&
              availableCharacters.length > 0
            ) {
              anyAvailable = true;
              break; // No need to check other rarities
            }
          } catch (rarityError) {
            console.warn(`Error checking rarity ${rarityIndex}:`, rarityError);
            // Continue to next rarity
          }
        }

        // Update state and cache based on availability
        setIsMintable(anyAvailable);
        setStatusText(anyAvailable ? "Available" : "Sold Out");

        // Update cache
        mintabilityCache[cacheKey] = {
          timestamp: Date.now(),
          isMintable: anyAvailable,
        };
      } catch (error) {
        console.error("Error checking ERC1155 mintability:", error);
        // In case of error, assume it's mintable to avoid blocking potential mints
        setIsMintable(true);
        setStatusText("Availability Unknown");
      } finally {
        setIsChecking(false);
      }
    };

    // Start the check
    checkERC1155Mintability();
  }, [collection]);

  return { isMintable, isChecking, statusText };
}
