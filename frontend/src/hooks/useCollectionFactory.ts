// hooks/useCollectionFactory.ts
import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseEther, decodeEventLog } from "viem";
import { NFT_FACTORY_ADDRESS } from "@/constants/addresses";
import FactoryABI from "@/contracts/BasedSeaCollectionFactory.json";

// Hook for creating a new collection
export function useCreateCollection() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const createCollection = async (
    name: string,
    symbol: string,
    baseURI: string,
    unrevealedURI: string,
    contractURI: string,
    mintPrice: number,
    maxSupply: number,
    maxTokensPerWallet: number,
    royaltyFee: number,
    mintingEnabled: boolean = false,
    startRevealed: boolean = true
  ) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);
    setTxHash(null);

    try {
      if (!walletClient || !publicClient || !address) {
        throw new Error("Wallet not connected");
      }

      // Convert mintPrice from ETH to wei
      const mintPriceInWei = parseEther(mintPrice.toString());

      // Set creation fee to 10,000 BASED
      // const creationFee = parseEther("10000"); // 10,000 BASED (𝔹)
      // Set creation fee to 0.001 ETH
      const creationFee = parseEther("0.001");

      // Use wagmi's writeContract with the updated parameters
      const hash = await walletClient.writeContract({
        address: NFT_FACTORY_ADDRESS as `0x${string}`,
        abi: FactoryABI.abi,
        functionName: "createCollection",
        args: [
          name,
          symbol,
          baseURI,
          unrevealedURI,
          contractURI,
          mintPriceInWei,
          BigInt(maxSupply),
          BigInt(maxTokensPerWallet),
          BigInt(royaltyFee),
          mintingEnabled,
          startRevealed,
        ],
        value: creationFee,
      });

      console.log("Transaction hash:", hash);

      setTxHash(hash);

      // Wait for transaction
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      console.log("Transaction receipt:", receipt);
      let collectionAddress = null;

      // Get collection address from the event logs
      for (const log of receipt.logs) {
        try {
          const event = decodeEventLog({
            abi: FactoryABI.abi,
            data: log.data,
            topics: log.topics,
          });

          // Check if this is our CollectionCreated event
          if (event.eventName === "CollectionCreated") {
            // Access the collection address directly from the event
            collectionAddress = event.args?.[1]; // Second parameter in the event

            console.log("Collection created at:", collectionAddress);
            return collectionAddress;
          }
        } catch (e) {
          console.error("Error decoding event:", e);
          // This log wasn't for our event, continue to the next log
          continue;
        }
      }

      if (!collectionAddress) {
        throw new Error(
          "Failed to get collection address from transaction receipt"
        );
      }

      setIsSuccess(true);
      setIsLoading(false);

      return collectionAddress;
    } catch (err) {
      console.error("Error creating collection:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
      throw err;
    }
  };

  return {
    createCollection,
    isLoading,
    isSuccess,
    error,
    txHash,
  };
}
