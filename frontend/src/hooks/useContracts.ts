// frontend/src/hooks/useContracts.ts
import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useTransaction,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { Collection } from "@/types/contracts";
import { FACTORY_ADDRESS, MARKETPLACE_ADDRESS } from "@/config/web3";
import { fetchFromIPFS } from "@/services/ipfs";

// Import ABIs (you'll need to generate these from your compiled contracts)
import FactoryABI from "@/contracts/PepeCollectionFactory.json";
import CollectionABI from "@/contracts/PepeNFTCollection.json";
import MarketplaceABI from "@/contracts/PepeMarketplace.json";

// Hook for fetching collections
export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read collections from factory
  const { data: collectionAddresses } = useReadContract({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: FactoryABI.abi,
    functionName: "getCollections",
  });

  const fetchCollectionDetails = useCallback(async () => {
    if (!collectionAddresses) return;

    setLoading(true);
    try {
      const collectionsData: Collection[] = [];

      for (const address of collectionAddresses as string[]) {
        // Fetch basic collection details
        const name = await readCollectionProperty(address, "name");
        const symbol = await readCollectionProperty(address, "symbol");
        const collectionURI = await readCollectionProperty(
          address,
          "collectionURI"
        );
        const mintPrice = await readCollectionProperty(address, "mintPrice");
        const maxSupply = await readCollectionProperty(address, "maxSupply");
        const totalMinted = await readCollectionProperty(
          address,
          "totalMinted"
        );
        const royaltyFee = await readCollectionProperty(address, "royaltyFee");
        const owner = await readCollectionProperty(address, "owner");

        // Fetch metadata from IPFS
        let metadata = undefined;
        try {
          metadata = await fetchFromIPFS(collectionURI as string);
        } catch (err) {
          console.error(
            `Failed to fetch metadata for collection ${address}`,
            err
          );
        }

        collectionsData.push({
          address,
          name: name as string,
          symbol: symbol as string,
          collectionURI: collectionURI as string,
          mintPrice: formatEther(mintPrice as bigint),
          maxSupply: Number(maxSupply),
          totalMinted: Number(totalMinted),
          royaltyFee: Number(royaltyFee),
          owner: owner as string,
          metadata,
        });
      }

      setCollections(collectionsData);
      setError(null);
    } catch (err) {
      console.error("Error fetching collections:", err);
      setError("Failed to fetch collections");
    } finally {
      setLoading(false);
    }
  }, [collectionAddresses]);

  useEffect(() => {
    fetchCollectionDetails();
  }, [fetchCollectionDetails]);

  const refreshCollections = useCallback(() => {
    fetchCollectionDetails();
  }, [fetchCollectionDetails]);

  return { collections, loading, error, refreshCollections };
}

// Hook for creating a new collection
export function useCreateCollection() {
  const { address } = useAccount();
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });

  const createCollection = async (
    name: string,
    symbol: string,
    collectionURI: string,
    mintPrice: string,
    maxSupply: number,
    royaltyFee: number
  ) => {
    if (!address) throw new Error("Wallet not connected");

    writeContract({
      address: FACTORY_ADDRESS as `0x${string}`,
      abi: FactoryABI.abi,
      functionName: "createCollection",
      args: [
        name,
        symbol,
        collectionURI,
        parseEther(mintPrice),
        BigInt(maxSupply),
        BigInt(royaltyFee),
      ],
      value: parseEther("0.01"), // Creation fee
    });
  };

  return {
    createCollection,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash: data,
  };
}

// Hook for minting an NFT
export function useMintNFT(collectionAddress: string) {
  const { address } = useAccount();
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });

  const mintNFT = async (tokenURI: string, price: string) => {
    if (!address) throw new Error("Wallet not connected");

    writeContract({
      address: collectionAddress as `0x${string}`,
      abi: CollectionABI.abi,
      functionName: "mint",
      args: [address, tokenURI],
      value: parseEther(price),
    });
  };

  return {
    mintNFT,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash: data,
  };
}

// Hook for listing an NFT
export function useListNFT() {
  const { address } = useAccount();
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });

  const listNFT = async (
    nftContract: string,
    tokenId: number,
    price: string
  ) => {
    if (!address) throw new Error("Wallet not connected");

    writeContract({
      address: MARKETPLACE_ADDRESS as `0x${string}`,
      abi: MarketplaceABI.abi,
      functionName: "listItem",
      args: [nftContract, BigInt(tokenId), parseEther(price)],
    });
  };

  return {
    listNFT,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash: data,
  };
}

// Hook for buying an NFT
export function useBuyNFT() {
  const { address } = useAccount();
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });

  const buyNFT = async (
    nftContract: string,
    tokenId: number,
    price: string
  ) => {
    if (!address) throw new Error("Wallet not connected");

    writeContract({
      address: MARKETPLACE_ADDRESS as `0x${string}`,
      abi: MarketplaceABI.abi,
      functionName: "buyItem",
      args: [nftContract, BigInt(tokenId)],
      value: parseEther(price),
    });
  };

  return {
    buyNFT,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash: data,
  };
}

// Helper function to read a property from a collection
async function readCollectionProperty(
  collectionAddress: string,
  property: string
) {
  try {
    const result = await fetch(
      `/api/contracts/readCollection?address=${collectionAddress}&property=${property}`
    );
    const data = await result.json();
    return data.result;
  } catch (err) {
    console.error(
      `Error reading ${property} from collection ${collectionAddress}:`,
      err
    );
    throw err;
  }
}
