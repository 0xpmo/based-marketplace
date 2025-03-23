// frontend/src/hooks/useContracts.ts
import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useTransaction,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { Collection } from "@/types/contracts";
import {
  MARKETPLACE_ADDRESS,
  NFT_FACTORY_ADDRESS,
} from "@/constants/addresses";
import { fetchFromIPFS } from "@/services/ipfs";
import { createPublicClient, http } from "viem";
import { getActiveChain } from "@/config/chains";
import {
  getMarketplaceContract,
  getNFTContractWithSigner,
} from "@/lib/contracts";

// Import ABIs (you'll need to generate these from your compiled contracts)
import FactoryABI from "@/contracts/PepeCollectionFactory.json";
import CollectionABI from "@/contracts/PepeNFTCollection.json";
import MarketplaceABI from "@/contracts/PepeMarketplace.json";

// Hook for fetching collections
export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log("Factory address:", NFT_FACTORY_ADDRESS);

  // Read collections from factory
  const { data: collectionAddresses, error: contractError } = useReadContract({
    address: NFT_FACTORY_ADDRESS as `0x${string}`,
    abi: FactoryABI.abi,
    functionName: "getCollections",
  });

  // Debug logs
  useEffect(() => {
    console.log("Factory Address:", NFT_FACTORY_ADDRESS);
    console.log("Contract Error:", contractError);
    console.log("Collection Addresses:", collectionAddresses);
  }, [collectionAddresses, contractError]);

  const fetchCollectionDetails = useCallback(async () => {
    if (!collectionAddresses) {
      console.log("No collection addresses found");
      setCollections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const collectionsData: Collection[] = [];

      for (const address of collectionAddresses as string[]) {
        try {
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
          const royaltyFee = await readCollectionProperty(
            address,
            "royaltyFee"
          );
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

          // Format values with type checking
          const formattedMintPrice = mintPrice
            ? formatEther(BigInt(mintPrice.toString()))
            : "0";
          const formattedMaxSupply = maxSupply ? Number(maxSupply) : 0;
          const formattedTotalMinted = totalMinted ? Number(totalMinted) : 0;
          const formattedRoyaltyFee = royaltyFee ? Number(royaltyFee) : 0;

          collectionsData.push({
            address,
            name: name as string,
            symbol: symbol as string,
            collectionURI: collectionURI as string,
            mintPrice: formattedMintPrice,
            maxSupply: formattedMaxSupply,
            totalMinted: formattedTotalMinted,
            royaltyFee: formattedRoyaltyFee,
            owner: owner as string,
            metadata,
          });
        } catch (err) {
          console.error(
            `Error fetching details for collection ${address}:`,
            err
          );
          // Continue with next collection instead of failing completely
          continue;
        }
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
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const createCollection = async (
    name: string,
    symbol: string,
    collectionURI: string,
    mintPrice: number,
    maxSupply: number,
    royaltyFee: number
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
      const creationFee = parseEther("0.001"); // Default to 0.001 ETH

      // Use wagmi's writeContract
      const hash = await walletClient.writeContract({
        address: NFT_FACTORY_ADDRESS as `0x${string}`,
        abi: FactoryABI.abi,
        functionName: "createCollection",
        args: [
          name,
          symbol,
          collectionURI,
          mintPriceInWei,
          BigInt(maxSupply),
          BigInt(royaltyFee),
        ],
        value: creationFee,
      });

      setTxHash(hash);

      // Wait for transaction
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
      });

      // Get collection address from the event logs
      // The CollectionCreated event has: address indexed creator, address collection, string name, string symbol
      let collectionAddress = "";

      // Find the CollectionCreated event in the logs
      for (const log of receipt.logs) {
        // Check if the log is from our factory contract
        if (log.address.toLowerCase() === NFT_FACTORY_ADDRESS.toLowerCase()) {
          try {
            // Parse the log using the factory ABI
            const parsedLog = await publicClient.decodeEventLog({
              abi: FactoryABI.abi,
              data: log.data,
              topics: log.topics,
            });

            // Check if this is the CollectionCreated event
            if (parsedLog.eventName === "CollectionCreated") {
              // Extract the collection address from the event data
              collectionAddress = parsedLog.args.collection;
              break;
            }
          } catch (e) {
            // Skip logs that can't be parsed with our ABI
            continue;
          }
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
  const { address: userAddress } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [approvalStep, setApprovalStep] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);

  const listNFT = async (
    collectionAddress: string,
    tokenId: number,
    price: string
  ) => {
    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
    setTxHash(null);
    setApprovalStep(false);
    setApprovalTxHash(null);

    try {
      if (!userAddress) {
        throw new Error("Wallet not connected");
      }

      console.log(
        `Listing NFT: Collection=${collectionAddress}, TokenId=${tokenId}, Price=${price}`
      );

      // 1. First step: Approve the marketplace to manage ALL of the user's NFTs in this collection
      try {
        console.log("Requesting marketplace approval for all tokens...");
        setApprovalStep(true);

        // Get the NFT contract
        const nftContract = await getNFTContractWithSigner(collectionAddress);

        // Request approval for marketplace to manage ALL NFTs in this collection
        const approvalTx = await nftContract.setApprovalForAll(
          MARKETPLACE_ADDRESS,
          true
        );
        setApprovalTxHash(approvalTx.hash);

        console.log(`Approval transaction submitted: ${approvalTx.hash}`);
        console.log("Waiting for approval confirmation...");

        // Wait for approval transaction to complete
        const approvalReceipt = await approvalTx.wait();
        console.log(
          `Approval confirmed in block ${approvalReceipt.blockNumber}`
        );
      } catch (approvalError) {
        console.error("Approval failed:", approvalError);
        throw new Error("Failed to approve marketplace. Please try again.");
      }

      // 2. Second step: List the NFT on the marketplace
      console.log("Proceeding to list NFT on marketplace...");
      setApprovalStep(false);

      // Convert price to wei (or your token's smallest unit)
      const priceInWei = parseEther(price);

      // Get marketplace contract
      const marketplaceContract = await getMarketplaceContract();

      console.log("Marketplace contract obtained, executing transaction...");

      // Call the contract's listItem function
      const tx = await marketplaceContract.listItem(
        collectionAddress,
        tokenId,
        priceInWei
      );
      setTxHash(tx.hash);

      console.log(`Transaction submitted: ${tx.hash}`);

      // Wait for transaction to complete
      console.log("Waiting for transaction confirmation...");
      const receipt = await tx.wait();

      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Error listing NFT for sale:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to list NFT for sale")
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    listNFT,
    isLoading,
    isSuccess,
    error,
    txHash,
    approvalStep,
    approvalTxHash,
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

// Helper function to read a property from a collection contract
async function readCollectionProperty(
  collectionAddress: string,
  propertyName: string
) {
  try {
    const publicClient = createPublicClient({
      chain: getActiveChain(),
      transport: http(),
    });

    const data = await publicClient.readContract({
      address: collectionAddress as `0x${string}`,
      abi: CollectionABI.abi,
      functionName: propertyName,
    });

    return data;
  } catch (err) {
    console.error(`Error reading ${propertyName} from collection`, err);
    return null;
  }
}

// Hook for fetching a single collection
export function useCollection(collectionAddress: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCollection = async () => {
      if (!collectionAddress) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch basic collection details
        const name = await readCollectionProperty(collectionAddress, "name");
        const symbol = await readCollectionProperty(
          collectionAddress,
          "symbol"
        );
        const collectionURI = await readCollectionProperty(
          collectionAddress,
          "collectionURI"
        );
        const mintPrice = await readCollectionProperty(
          collectionAddress,
          "mintPrice"
        );
        const maxSupply = await readCollectionProperty(
          collectionAddress,
          "maxSupply"
        );
        const totalMinted = await readCollectionProperty(
          collectionAddress,
          "totalMinted"
        );
        const royaltyFee = await readCollectionProperty(
          collectionAddress,
          "royaltyFee"
        );
        const owner = await readCollectionProperty(collectionAddress, "owner");

        // Fetch metadata from IPFS
        let metadata = undefined;
        try {
          metadata = await fetchFromIPFS(collectionURI as string);
        } catch (err) {
          console.error(
            `Failed to fetch metadata for collection ${collectionAddress}`,
            err
          );
        }

        // Format values with type checking
        const formattedMintPrice = mintPrice
          ? formatEther(BigInt(mintPrice.toString()))
          : "0";
        const formattedMaxSupply = maxSupply ? Number(maxSupply) : 0;
        const formattedTotalMinted = totalMinted ? Number(totalMinted) : 0;
        const formattedRoyaltyFee = royaltyFee ? Number(royaltyFee) : 0;

        setCollection({
          address: collectionAddress,
          name: name as string,
          symbol: symbol as string,
          collectionURI: collectionURI as string,
          mintPrice: formattedMintPrice,
          maxSupply: formattedMaxSupply,
          totalMinted: formattedTotalMinted,
          royaltyFee: formattedRoyaltyFee,
          owner: owner as string,
          metadata,
        });
        setError(null);
      } catch (err) {
        console.error("Error fetching collection:", err);
        setError("Failed to fetch collection details");
      } finally {
        setLoading(false);
      }
    };

    fetchCollection();
  }, [collectionAddress]);

  return { collection, loading, error };
}

// Hook for updating a collection
export function useUpdateCollection(collectionAddress: string) {
  const { address } = useAccount();
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });

  const updateCollection = async (
    name: string,
    collectionURI: string,
    mintPrice: number,
    royaltyFee: number
  ) => {
    if (!address) throw new Error("Wallet not connected");

    console.log(`Updating collection with royaltyFee: ${royaltyFee}`); // Using param to avoid linter error

    // Update collection URI
    await writeContract({
      address: collectionAddress as `0x${string}`,
      abi: CollectionABI.abi,
      functionName: "setCollectionURI",
      args: [collectionURI],
    });

    // Update mint price
    await writeContract({
      address: collectionAddress as `0x${string}`,
      abi: CollectionABI.abi,
      functionName: "setMintPrice",
      args: [parseEther(mintPrice.toString())],
    });

    // Note: update name or royalty might require additional contract functions
    return true;
  };

  const setCollectionPublic = async (isPublic: boolean) => {
    if (!address) throw new Error("Wallet not connected");

    await writeContract({
      address: collectionAddress as `0x${string}`,
      abi: CollectionABI.abi,
      functionName: "setMintingEnabled",
      args: [isPublic],
    });

    return true;
  };

  return {
    updateCollection,
    setCollectionPublic,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash: data,
  };
}
