// frontend/src/hooks/useContracts.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useTransaction,
  usePublicClient,
  useWalletClient,
  useConfig,
} from "wagmi";
import { parseEther, formatEther, decodeEventLog, PublicClient } from "viem";
import { Collection, CollectionMetadata, NFTItem } from "@/types/contracts";
import {
  MARKETPLACE_ADDRESS,
  NFT_FACTORY_ADDRESS,
} from "@/constants/addresses";
import { EXTERNAL_COLLECTIONS } from "@/constants/collections";
import { fetchFromIPFS, fetchBatchMetadataFromIPFS } from "@/services/ipfs";
import { createPublicClient, http } from "viem";
import { getActiveChain } from "@/config/chains";
import {
  getMarketplaceContract,
  getNFTContractWithSigner,
} from "@/lib/contracts";
import { switchChain } from "wagmi/actions";
// Import database functions
import {
  createListing,
  updateListingStatus,
  getCollectionListings,
  getListing,
  clearListing,
} from "@/lib/db";

// Import ABIs (you'll need to generate these from your compiled contracts)
import FactoryABI from "@/contracts/BasedSeaCollectionFactory.json";
import CollectionABI from "@/contracts/BasedSeaSequentialNFTCollection.json";
import MarketplaceABI from "@/contracts/BasedSeaMarketplace.json";

// Hook for fetching based collections from factory
export function useBasedCollections() {
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
          const name = await readCollectionProperty(address, "name", false);
          const symbol = await readCollectionProperty(address, "symbol", false);
          const contractURI = await readCollectionProperty(
            address,
            "contractURI",
            false
          );
          const mintPrice = await readCollectionProperty(
            address,
            "mintPrice",
            false
          );
          const maxSupply = await readCollectionProperty(
            address,
            "MAX_SUPPLY",
            false
          );
          const totalMinted = await readCollectionProperty(
            address,
            "totalMinted",
            false
          );
          const totalSupply = await readCollectionProperty(
            address,
            "totalSupply",
            false
          );
          const royaltyInfo = await readCollectionProperty(
            address,
            "royaltyInfo",
            false,
            [0, 10000] // Use tokenId 0 and sample price of 10000
          );
          const owner = await readCollectionProperty(address, "owner", false);
          const mintingEnabled = await readCollectionProperty(
            address,
            "mintingEnabled",
            false
          );

          // Extract royalty fee from royaltyInfo (if using ERC2981)
          const royaltyFee =
            royaltyInfo && Array.isArray(royaltyInfo) && royaltyInfo.length > 1
              ? Number(royaltyInfo[1])
              : 0;

          // Fetch metadata from IPFS
          let metadata = undefined;
          try {
            metadata = await fetchFromIPFS(contractURI as string);
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
          const formattedRoyaltyFee = royaltyFee;

          collectionsData.push({
            address,
            name: name as string,
            symbol: symbol as string,
            contractURI: contractURI as string,
            mintPrice: formattedMintPrice,
            maxSupply: formattedMaxSupply,
            totalMinted: formattedTotalMinted,
            royaltyFee: formattedRoyaltyFee,
            owner: owner as string,
            metadata: metadata as unknown as CollectionMetadata,
            mintingEnabled: mintingEnabled as boolean,
            source: "based",
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

// Helper function to fetch and parse metadata from contractURI or other sources
async function fetchCollectionMetadata(
  contractURI: string | null,
  collectionName?: string
): Promise<CollectionMetadata | null> {
  if (!contractURI) {
    console.log("No contractURI provided for metadata fetching");
    return null;
  }

  try {
    // Check if contractURI is already a JSON object (some contracts return JSON directly)
    if (contractURI.startsWith("{") && contractURI.endsWith("}")) {
      try {
        const parsed = JSON.parse(contractURI);
        return parsed as unknown as CollectionMetadata;
      } catch (parseError) {
        console.error("Error parsing inline JSON contractURI:", parseError);
      }
    }

    // Try to fetch from IPFS or HTTP URL
    const metadata = await fetchFromIPFS(contractURI);

    // Add a fallback name if none is provided in metadata
    if (metadata && !metadata.name && collectionName) {
      metadata.name = collectionName;
    }

    // Add placeholder image/banner if not provided
    if (metadata && !metadata.image) {
      metadata.image = "/images/placeholder-collection.svg";
    }

    return metadata as unknown as CollectionMetadata;
  } catch (err) {
    console.error(`Failed to fetch metadata from ${contractURI}:`, err);

    // Return minimal metadata with name if we have it
    if (collectionName) {
      return {
        name: collectionName,
        description: `Collection ${collectionName}`,
        image: "/images/placeholder-collection.svg",
      } as unknown as CollectionMetadata;
    }

    return null;
  }
}

// Hook for fetching external collections from in-memory list
export function useExternalCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug logs
  useEffect(() => {
    console.log("External Collections Count:", EXTERNAL_COLLECTIONS.length);
  }, []);

  const fetchExternalCollections = useCallback(async () => {
    if (EXTERNAL_COLLECTIONS.length === 0) {
      console.log("No external collections configured");
      setCollections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const collectionsData: Collection[] = [];

      for (const externalCollection of EXTERNAL_COLLECTIONS) {
        try {
          const address = externalCollection.address;
          console.log(`Fetching external collection: ${address}`);

          // Fetch standard ERC721 properties first
          const name = await readCollectionProperty(address, "name", true);
          const symbol = await readCollectionProperty(address, "symbol", true);
          const contractURI = await readCollectionProperty(
            address,
            "contractURI",
            true
          );
          const totalSupply = await readCollectionProperty(
            address,
            "totalSupply",
            true
          );

          // Provide contextual logging
          console.log(`Collection ${address} basic info:`, {
            name,
            symbol,
            hasContractURI: !!contractURI,
            totalSupply: totalSupply ? Number(totalSupply) : null,
          });

          // Fetch other potential properties, handling errors gracefully
          let mintPrice, royaltyInfo, owner, mintingEnabled;

          try {
            mintPrice = await readCollectionProperty(
              address,
              "mintPrice",
              true
            );
          } catch (e) {
            console.log(`Collection ${address} might not have mintPrice`);
            mintPrice = 0;
          }

          try {
            // Try fetching royaltyInfo first (ERC2981 standard)
            royaltyInfo = await readCollectionProperty(
              address,
              "royaltyInfo",
              true,
              [0, 10000]
            );
          } catch (e) {
            console.log(`Collection ${address} might not have royaltyInfo`);
            royaltyInfo = null;
          }

          try {
            owner = await readCollectionProperty(address, "owner", true);
          } catch (e) {
            console.log(`Collection ${address} might not have owner method`);
            owner = "0x0000000000000000000000000000000000000000"; // Default to zero address
          }

          try {
            // Check for a mintingEnabled function, assume false if not present
            mintingEnabled = await readCollectionProperty(
              address,
              "mintingEnabled",
              true
            );
            if (mintingEnabled === null) mintingEnabled = false; // Default to false if read fails
          } catch (e) {
            console.log(`Collection ${address} might not have mintingEnabled`);
            mintingEnabled = false;
          }

          // Fetch metadata with enhanced error handling
          const collectionNameStr =
            externalCollection.name ||
            (name as string) ||
            `Collection ${address.slice(0, 6)}`;
          let metadata: CollectionMetadata | null = null;

          if (contractURI) {
            metadata = await fetchCollectionMetadata(
              contractURI as string,
              collectionNameStr
            );
            console.log(
              `Collection ${address} metadata:`,
              metadata ? "fetched successfully" : "failed to fetch"
            );
          } else {
            console.log(
              `Collection ${address} does not have a contractURI, creating basic metadata`
            );

            // Create basic metadata if contractURI is not available
            metadata = {
              name: collectionNameStr,
              description:
                externalCollection.description ||
                `NFT collection at ${address}`,
              image: "/images/placeholder-collection.svg",
            } as unknown as CollectionMetadata;
          }

          // Format values and handle possible missing properties
          const formattedMintPrice = mintPrice
            ? formatEther(BigInt(mintPrice.toString()))
            : "0";
          const formattedTotalSupply = totalSupply ? Number(totalSupply) : 0;

          // Extract royalty fee from royaltyInfo if available
          let formattedRoyaltyFee = 0;
          if (
            royaltyInfo &&
            Array.isArray(royaltyInfo) &&
            royaltyInfo.length > 1
          ) {
            formattedRoyaltyFee = Number(royaltyInfo[1]); // Assuming ERC2981 format [receiver, feeAmount]
          }

          // Check if this is a manually deployed BasedNFT contract
          const isManualBasedContract =
            externalCollection.isBasedContract === true;

          collectionsData.push({
            address,
            name: (name as string) || metadata?.name || "Unknown Collection",
            symbol: (symbol as string) || "UNKNOWN",
            contractURI: (contractURI as string) || "",
            mintPrice: formattedMintPrice,
            maxSupply: 0, // Standard ERC721 doesn't have maxSupply, use 0 by default
            totalMinted: formattedTotalSupply, // Use totalSupply here
            royaltyFee: formattedRoyaltyFee, // Calculated from royaltyInfo or defaults to 0
            owner: owner as string,
            metadata: metadata as unknown as CollectionMetadata,
            mintingEnabled: mintingEnabled as boolean,
            source: isManualBasedContract ? "based" : "external", // Use "based" source for manually deployed BasedNFT contracts
          });

          console.log(
            `Successfully added collection ${address} to collectionsData`
          );
        } catch (err) {
          console.error(
            `Error fetching details for external collection ${externalCollection.address}:`,
            err
          );
          // Continue with next collection instead of failing completely
          continue;
        }
      }

      setCollections(collectionsData);
      setError(null);
    } catch (err) {
      console.error("Error fetching external collections:", err);
      setError("Failed to fetch external collections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExternalCollections();
  }, [fetchExternalCollections]);

  const refreshCollections = useCallback(() => {
    fetchExternalCollections();
  }, [fetchExternalCollections]);

  return { collections, loading, error, refreshCollections };
}

// Combined hook that fetches both based and external collections
export function useCollections() {
  const { collections, loading, error, refreshCollections } =
    useBasedCollections();
  // const {
  //   collections: basedCollections,
  //   loading: basedLoading,
  //   error: basedError,
  //   refreshCollections: refreshBasedCollections,
  // } = useBasedCollections();

  // const {
  //   collections: externalCollections,
  //   loading: externalLoading,
  //   error: externalError,
  //   refreshCollections: refreshExternalCollections,
  // } = useExternalCollections();

  // Combine the collections with based collections coming first
  // const collections = useMemo(() => {
  //   return [...basedCollections, ...externalCollections];
  // }, [basedCollections, externalCollections]);

  // const loading = basedLoading || externalLoading;
  // const error = basedError || externalError;

  // const refreshCollections = useCallback(() => {
  //   refreshBasedCollections();
  //   refreshExternalCollections();
  // }, [refreshBasedCollections, refreshExternalCollections]);

  return { collections, loading, error, refreshCollections };
}

// Helper function to check if a contract implements ERC721 interface
export async function isValidNFTCollection(collectionAddress: string) {
  try {
    const publicClient = createPublicClient({
      chain: getActiveChain(),
      transport: http(),
    });

    // Check if contract implements ERC721 interface
    const supportsERC721 = await publicClient.readContract({
      address: collectionAddress as `0x${string}`,
      abi: [
        {
          name: "supportsInterface",
          inputs: [{ type: "bytes4" }],
          outputs: [{ type: "bool" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "supportsInterface",
      args: ["0x80ac58cd"], // ERC721 interface ID
    });

    return !!supportsERC721;
  } catch (err) {
    console.error("Error checking collection validity:", err);
    return false;
  }
}

// Helper function to read a property from a collection contract
async function readCollectionProperty(
  collectionAddress: string,
  propertyName: string,
  isExternalCollection: boolean = false,
  args: unknown[] = []
) {
  try {
    const publicClient = createPublicClient({
      chain: getActiveChain(),
      transport: http(),
    });

    // Check if it's a manually deployed BasedNFT collection
    const manualBasedCollection = EXTERNAL_COLLECTIONS.find(
      (ec) =>
        ec.address.toLowerCase() === collectionAddress.toLowerCase() &&
        ec.isBasedContract
    );

    // Use the appropriate ABI based on the collection source
    let abi;

    if (isExternalCollection) {
      try {
        // Try to import a specific ABI file for this external collection
        const contractAddress = collectionAddress.startsWith("0x")
          ? collectionAddress.substring(2).toLowerCase()
          : collectionAddress.toLowerCase();

        // First, try to import a collection-specific ABI file
        abi = (await import(`@/contracts/${contractAddress}.json`)).abi;
        console.log(`Using specific ABI for collection ${collectionAddress}`);
      } catch (error) {
        // If specific ABI not found, check if it's a manually deployed BasedNFT
        if (manualBasedCollection) {
          abi = CollectionABI.abi;
          console.log(
            `Using BasedNFT ABI for manually deployed collection ${collectionAddress}`
          );
        } else {
          // Otherwise, use the generic ERC721 ABI as fallback
          // Ensure you have a generic ERC721 ABI file, e.g., ExternalERC721.json
          try {
            abi = (await import("@/contracts/ExternalERC721.json")).abi;
            console.log(
              `Using generic ERC721 ABI for collection ${collectionAddress}`
            );
          } catch (abiError) {
            console.error(
              `Failed to load generic ERC721 ABI. Make sure ExternalERC721.json exists in @/contracts.`,
              abiError
            );
            throw new Error(
              `ABI not found for external collection ${collectionAddress}`
            );
          }
        }
      }
    } else {
      // For factory collections, always use the BasedNFT ABI
      abi = CollectionABI.abi;
    }

    // Check if the function exists in the ABI before calling
    const functionExists = abi.some(
      (item: { type?: string; name?: string }) =>
        item.type === "function" && item.name === propertyName
    );

    if (!functionExists) {
      console.log(
        `Function ${propertyName} not found in ABI for collection ${collectionAddress}`
      );
      // Return null or throw an error based on how you want to handle missing functions
      return null; // Or throw new Error(`Function ${propertyName} not found`);
    }

    const data = await publicClient.readContract({
      address: collectionAddress as `0x${string}`,
      abi,
      functionName: propertyName,
      args,
    });

    return data;
  } catch (err) {
    // Log specific errors for contract calls
    if (err instanceof Error && "message" in err) {
      if (
        err.message.includes("call reverted") ||
        err.message.includes("invalid opcode")
      ) {
        console.warn(
          `Contract call for ${propertyName} on ${collectionAddress} reverted or failed.`
        );
      } else {
        console.error(
          `Error reading ${propertyName} from collection ${collectionAddress}:`,
          err
        );
      }
    } else {
      console.error(
        `Unknown error reading ${propertyName} from collection ${collectionAddress}:`,
        err
      );
    }
    // Return null to indicate failure without crashing the whole process
    return null;
  }
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

// Hook for minting an NFT
export function useMintNFT(collectionAddress: string) {
  const { address, chainId } = useAccount();
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });
  const publicClient = usePublicClient();
  const config = useConfig();
  const targetChainId = getActiveChain().id;

  // Log the active chain when the hook is initialized
  useEffect(() => {
    console.log("Active chain in useMintNFT:", publicClient?.chain);
    console.log(
      "Target chain for minting:",
      getActiveChain().name,
      targetChainId
    );
  }, [publicClient, targetChainId]);

  const mintNFT = async (price: string) => {
    if (!address) throw new Error("Wallet not connected");

    // Check if on the correct chain
    if (chainId !== targetChainId) {
      console.log(
        `Wrong chain detected: ${chainId}. Should be: ${targetChainId}`
      );

      try {
        console.log("Attempting to switch chains...");
        await switchChain(config, { chainId: targetChainId });
        console.log("Chain switched successfully");
      } catch (switchError) {
        console.error("Failed to switch chains:", switchError);
        throw new Error(
          `Please switch to the ${
            getActiveChain().name
          } network in your wallet to mint`
        );
      }
    }

    console.log(
      "Minting on chain:",
      publicClient?.chain?.name || targetChainId
    );
    console.log("Minting to collection:", collectionAddress);
    console.log("Mint price:", price);

    try {
      await writeContract({
        address: collectionAddress as `0x${string}`,
        abi: CollectionABI.abi,
        functionName: "mint",
        args: [address],
        value: parseEther(price),
        chainId: targetChainId,
      });
    } catch (mintError) {
      console.error("Mint error:", mintError);

      // Check for chain-related errors
      const errorMsg =
        mintError instanceof Error ? mintError.message : String(mintError);

      if (errorMsg.includes("chain") || errorMsg.includes("network")) {
        throw new Error(
          `Wrong network detected. Please switch to ${getActiveChain().name}`
        );
      }

      throw mintError;
    }
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
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient(); // Add this to get the signer

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
      if (!userAddress || !walletClient || !publicClient) {
        throw new Error("Wallet not connected");
      }

      console.log(
        `Listing NFT: Collection=${collectionAddress}, TokenId=${tokenId}, Price=${price}`
      );

      // 1. First step: Approve the marketplace to manage THIS SPECIFIC token
      try {
        console.log(`Requesting marketplace approval for token #${tokenId}...`);
        setApprovalStep(true);

        // Get the NFT contract
        const nftContract = await getNFTContractWithSigner(collectionAddress);

        // Request approval for marketplace to manage ONLY this specific NFT token
        const approvalTx = await nftContract.approve(
          MARKETPLACE_ADDRESS,
          tokenId
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

      // Get the next nonce
      const nonce = await publicClient.getTransactionCount({
        address: userAddress,
        blockTag: "pending",
      });

      // Call the contract's listItem function with proper gas settings and nonce
      const tx = await marketplaceContract.listItem(
        collectionAddress,
        tokenId,
        priceInWei,
        {
          gasPrice: 9,
          gasLimit: 3000000,
          nonce: nonce, // Use the nonce from publicClient
        }
      );

      setTxHash(tx.hash);

      console.log(`Transaction submitted: ${tx.hash}`);

      // Wait for transaction to complete
      console.log("Waiting for transaction confirmation...");
      const receipt = await tx.wait();

      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

      // 3. Store the listing in database
      try {
        await createListing(
          userAddress,
          collectionAddress,
          tokenId,
          price,
          false, // isPrivate
          null, // allowedBuyer
          tx.hash,
          BigInt(receipt.blockNumber)
        );
        console.log("Listing stored in database successfully");
      } catch (dbError) {
        console.error("Error storing listing in database:", dbError);
        // Continue with success even if database storage fails
        // We might want to implement a retry mechanism or queue here
      }

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
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const buyNFT = async (
    nftContract: string,
    tokenId: number,
    price: string
  ) => {
    if (!address || !walletClient || !publicClient)
      throw new Error("Wallet not connected");

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
    setTxHash(null);

    try {
      // Get the next nonce
      const nonce = await publicClient.getTransactionCount({
        address,
        blockTag: "pending",
      });

      // Get marketplace contract
      const marketplaceContract = await getMarketplaceContract();

      // Call the contract's buyItem function with proper gas settings and nonce
      const tx = await marketplaceContract.buyItem(nftContract, tokenId, {
        value: parseEther(price),
        gasPrice: 9,
        gasLimit: 3000000,
        nonce: nonce, // Use the nonce from publicClient
      });

      setTxHash(tx.hash);

      // Wait for transaction to complete
      const receipt = await tx.wait();

      // Update listing status in database (status 2 = Sold)
      try {
        await updateListingStatus(
          nftContract,
          tokenId,
          2, // 2 = Sold status
          tx.hash,
          BigInt(receipt.blockNumber)
        );
        console.log("Listing status updated to 'Sold' in database");
      } catch (dbError) {
        console.error("Error updating listing status in database:", dbError);
        // Continue with success even if database update fails
      }

      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Error buying NFT:", err);
      setError(err instanceof Error ? err : new Error("Failed to buy NFT"));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    buyNFT,
    isLoading,
    isSuccess,
    error,
    txHash,
  };
}

// New hook for creating and executing offers with signatures
export function useOffers() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });

  // Get offer hash for signing
  const getOfferHash = async (
    nftContract: string,
    tokenId: number,
    price: string,
    buyer: string,
    expiration: number
  ) => {
    if (!publicClient) throw new Error("Client not available");

    const priceInWei = parseEther(price);

    return await publicClient.readContract({
      address: MARKETPLACE_ADDRESS as `0x${string}`,
      abi: MarketplaceABI.abi,
      functionName: "getOfferHash",
      args: [
        nftContract as `0x${string}`,
        BigInt(tokenId),
        priceInWei,
        buyer as `0x${string}`,
        BigInt(expiration),
      ],
    });
  };

  // Execute an offer with signature
  const executeOffer = async (
    nftContract: string,
    tokenId: number,
    price: string,
    seller: string,
    expiration: number,
    signature: string
  ) => {
    if (!address) throw new Error("Wallet not connected");

    const priceInWei = parseEther(price);

    writeContract({
      address: MARKETPLACE_ADDRESS as `0x${string}`,
      abi: MarketplaceABI.abi,
      functionName: "executeOffer",
      args: [
        nftContract as `0x${string}`,
        BigInt(tokenId),
        priceInWei,
        seller as `0x${string}`,
        BigInt(expiration),
        signature as `0x${string}`,
      ],
      value: priceInWei,
    });
  };

  return {
    getOfferHash,
    executeOffer,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash: data,
  };
}

// Hook for creating private listings
export function usePrivateListing() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const createPrivateListing = async (
    nftContract: string,
    tokenId: number,
    price: string,
    allowedBuyer: string
  ) => {
    if (!address || !walletClient || !publicClient)
      throw new Error("Wallet not connected");

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
    setTxHash(null);

    try {
      const priceInWei = parseEther(price);

      // Get the next nonce
      const nonce = await publicClient.getTransactionCount({
        address,
        blockTag: "pending",
      });

      // Get marketplace contract
      const marketplaceContract = await getMarketplaceContract();

      // Call the contract's createPrivateListing function
      const tx = await marketplaceContract.createPrivateListing(
        nftContract,
        tokenId,
        priceInWei,
        allowedBuyer,
        {
          gasPrice: 9,
          gasLimit: 3000000,
          nonce: nonce,
        }
      );

      setTxHash(tx.hash);

      // Wait for transaction to complete
      const receipt = await tx.wait();

      // Store the private listing in database
      try {
        await createListing(
          address,
          nftContract,
          tokenId,
          price,
          true, // isPrivate
          allowedBuyer,
          tx.hash,
          BigInt(receipt.blockNumber)
        );
        console.log("Private listing stored in database successfully");
      } catch (dbError) {
        console.error("Error storing private listing in database:", dbError);
        // Continue with success even if database storage fails
      }

      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Error creating private listing:", err);
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to create private listing")
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createPrivateListing,
    isLoading,
    isSuccess,
    error,
    txHash,
  };
}

// Hook for fetching tokens owned by the current user (using ERC721Enumerable)
export function useOwnedTokens(collectionAddress: string) {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOwnedTokens = async () => {
      if (!address || !collectionAddress) {
        setTokens([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const publicClient = createPublicClient({
          chain: getActiveChain(),
          transport: http(),
        });

        // First try to get the balance of the user
        const balance = await publicClient.readContract({
          address: collectionAddress as `0x${string}`,
          abi: CollectionABI.abi,
          functionName: "balanceOf",
          args: [address],
        });

        const tokenCount = Number(balance);
        const tokenIds: number[] = [];

        // Then fetch each token ID using tokenOfOwnerByIndex
        for (let i = 0; i < tokenCount; i++) {
          try {
            const tokenId = await publicClient.readContract({
              address: collectionAddress as `0x${string}`,
              abi: CollectionABI.abi,
              functionName: "tokenOfOwnerByIndex",
              args: [address, BigInt(i)],
            });

            tokenIds.push(Number(tokenId));
          } catch (err) {
            console.error(`Error fetching token at index ${i}:`, err);
          }
        }

        setTokens(tokenIds);
        setError(null);
      } catch (err) {
        console.error("Error fetching owned tokens:", err);
        setError("Failed to fetch owned tokens");
      } finally {
        setLoading(false);
      }
    };

    fetchOwnedTokens();
  }, [address, collectionAddress]);

  return { tokens, loading, error };
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
        // First, determine if it's an external collection
        const externalCollection = EXTERNAL_COLLECTIONS.find(
          (ec) => ec.address.toLowerCase() === collectionAddress.toLowerCase()
        );

        const isExternal = !!externalCollection;
        const isManualBasedContract =
          externalCollection?.isBasedContract === true;

        // Fetch basic collection details
        const name = await readCollectionProperty(
          collectionAddress,
          "name",
          isExternal
        );
        const symbol = await readCollectionProperty(
          collectionAddress,
          "symbol",
          isExternal
        );
        const contractURI = await readCollectionProperty(
          collectionAddress,
          "contractURI",
          isExternal
        );
        const totalSupply = await readCollectionProperty(
          collectionAddress,
          "totalSupply",
          isExternal
        );

        // Provide debug information
        console.log(`Collection ${collectionAddress} info:`, {
          name,
          symbol,
          hasContractURI: !!contractURI,
          totalSupply,
        });

        // Fetch optional details, handle null returns
        const mintPrice = await readCollectionProperty(
          collectionAddress,
          "mintPrice",
          isExternal
        );
        const royaltyInfo = await readCollectionProperty(
          collectionAddress,
          "royaltyInfo",
          isExternal,
          [0, 10000]
        );
        const owner = await readCollectionProperty(
          collectionAddress,
          "owner",
          isExternal
        );
        const mintingEnabled = await readCollectionProperty(
          collectionAddress,
          "mintingEnabled",
          isExternal
        );

        // Extract royalty fee from royaltyInfo if it's available and valid
        let formattedRoyaltyFee = 0;
        if (
          royaltyInfo &&
          Array.isArray(royaltyInfo) &&
          royaltyInfo.length > 1
        ) {
          formattedRoyaltyFee = Number(royaltyInfo[1]);
        } else if (royaltyInfo && typeof royaltyInfo === "number") {
          // Handle if royaltyInfo directly returns the fee percentage or basis points
          formattedRoyaltyFee = Number(royaltyInfo);
        }

        // Create a name string for metadata fallback
        const collectionNameStr =
          externalCollection?.name ||
          (name as string) ||
          `Collection ${collectionAddress.slice(0, 6)}`;

        // Enhanced metadata handling
        let metadata: CollectionMetadata | null = null;

        if (contractURI) {
          metadata = await fetchCollectionMetadata(
            contractURI as string,
            collectionNameStr
          );
          console.log(
            `Collection ${collectionAddress} metadata:`,
            metadata ? "fetched successfully" : "failed to fetch"
          );
        } else {
          console.log(
            `Collection ${collectionAddress} does not have a contractURI, creating basic metadata`
          );

          // Create basic metadata if contractURI is not available
          metadata = {
            name: collectionNameStr,
            description:
              externalCollection?.description ||
              `NFT collection at ${collectionAddress}`,
            image: "/images/placeholder-collection.svg",
          } as unknown as CollectionMetadata;
        }

        // Format values with type checking and fallbacks
        const formattedMintPrice = mintPrice
          ? formatEther(BigInt(mintPrice.toString()))
          : "0";
        const formattedTotalSupply = totalSupply ? Number(totalSupply) : 0;

        setCollection({
          address: collectionAddress,
          name: (name as string) || metadata?.name || "Unknown Collection",
          symbol: (symbol as string) || "UNKNOWN",
          contractURI: (contractURI as string) || "",
          mintPrice: formattedMintPrice,
          maxSupply: 0, // Use 0 for maxSupply, rely on totalMinted
          totalMinted: formattedTotalSupply, // Use totalSupply here
          royaltyFee: formattedRoyaltyFee,
          owner:
            (owner as string) || "0x0000000000000000000000000000000000000000",
          metadata: metadata as unknown as CollectionMetadata,
          mintingEnabled: (mintingEnabled as boolean) ?? false, // Default to false if null
          source: isExternal
            ? isManualBasedContract
              ? "based"
              : "external"
            : "based",
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

// Hook for fetching NFTs in a collection - with pagination support
export function useCollectionNFTs(collectionAddress: string) {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Fetch NFTs for the current page
  const fetchPagedNFTs = useCallback(
    async (page: number) => {
      if (!collectionAddress) {
        console.log("No collection address, skipping fetch");
        return;
      }

      setLoading(true);
      setError(null);
      setNfts([]); // Clear previous NFTs

      try {
        // Create the public client
        const publicClient = createPublicClient({
          chain: getActiveChain(),
          transport: http(),
        });

        // Determine if it's external for ABI selection later
        const externalCollection = EXTERNAL_COLLECTIONS.find(
          (ec) => ec.address.toLowerCase() === collectionAddress.toLowerCase()
        );
        const isExternal = !!externalCollection;

        // Get total supply to determine the total number of tokens
        const totalSupply = await readCollectionProperty(
          collectionAddress,
          "totalSupply",
          isExternal
        );

        if (totalSupply === null || Number(totalSupply) === 0) {
          console.log(
            `Collection ${collectionAddress} has zero total supply or failed to fetch.`
          );
          setNfts([]);
          setLoading(false);
          setTotalTokens(0);
          setTotalPages(0);
          return;
        }

        const tokensCount = Number(totalSupply);
        setTotalTokens(tokensCount);
        setTotalPages(Math.ceil(tokensCount / pageSize));

        console.log(`Total tokens in collection: ${tokensCount}`);
        console.log(`Current page: ${page}, Page size: ${pageSize}`);

        // Calculate token IDs for the current page
        // Assuming sequential IDs from 0 to totalSupply-1
        const startIndex = page * pageSize;
        const endIndex = Math.min(startIndex + pageSize, tokensCount);

        if (startIndex >= tokensCount) {
          // Invalid page, reset to page 0
          setCurrentPage(0);
          return;
        }

        const pageTokenIds = Array.from(
          { length: endIndex - startIndex },
          (_, i) => startIndex + i
        );

        console.log(`Fetching tokens ${startIndex} to ${endIndex - 1}`);

        // Fetch basic token data for the current page
        const tokenDataPromises = pageTokenIds.map((tokenId) =>
          fetchBasicTokenData(
            collectionAddress,
            tokenId,
            publicClient,
            isExternal
          )
        );

        const tokensWithBasicData = (
          await Promise.all(tokenDataPromises)
        ).filter(Boolean) as NFTItem[]; // Filter out null results (e.g., non-existent tokens)

        console.log(
          `Fetched basic data for ${tokensWithBasicData.length} valid tokens`
        );

        // First fetch database listings for this collection
        try {
          const { listings: dbListings } = await getCollectionListings(
            collectionAddress,
            1, // Active listings only
            page,
            pageSize
          );

          console.log(`Fetched ${dbListings.length} listings from database`);

          // Map database listings to NFT objects
          if (dbListings.length > 0) {
            // Create a map of token ID to listing data
            const listingsMap = new Map(
              dbListings.map((listing) => [
                Number(listing.token_id),
                {
                  active: true,
                  price: listing.price,
                  seller: listing.seller,
                },
              ])
            );

            // Add the listings to the tokens data
            tokensWithBasicData.forEach((token) => {
              const dbListing = listingsMap.get(token.tokenId);
              if (dbListing) {
                token.listing = dbListing;
              }
            });

            console.log("Applied database listings to tokens");
          }
        } catch (dbError) {
          console.error("Error fetching listings from database:", dbError);
          // Continue without database listings if there's an error
        }

        // Update state with basic token data
        setNfts(tokensWithBasicData);
        setLoading(false);

        // Now fetch metadata and any remaining listing info from blockchain
        if (tokensWithBasicData.length > 0) {
          fetchMetadataAndListingsInBatches(tokensWithBasicData, publicClient);
        } else {
          setMetadataLoading(false); // No tokens, no metadata to load
        }
      } catch (err) {
        console.error(
          `Error fetching collection NFTs for ${collectionAddress}:`,
          err
        );
        setError("Failed to load NFTs. Please try again later.");
        setLoading(false);
      }
    },
    [collectionAddress, pageSize]
  );

  // Update when page changes
  useEffect(() => {
    if (collectionAddress) {
      fetchPagedNFTs(currentPage);
    }
  }, [collectionAddress, currentPage, fetchPagedNFTs]);

  // Go to next page
  const nextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages]);

  // Go to previous page
  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  // Go to a specific page
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 0 && page < totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages]
  );

  // Change page size
  const setPageSizeAndRefetch = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(0); // Reset to first page when changing page size
  }, []);

  // Add a forceful refresh function to useCollectionNFTs hook
  const refresh = useCallback(() => {
    console.log("Forcefully refreshing collection NFTs...");
    // Clear NFTs state before fetching again
    setNfts([]);
    // Reset loading states
    setLoading(true);
    setMetadataLoading(false);
    setError(null);
    // Re-fetch from the current page
    fetchPagedNFTs(currentPage);
  }, [fetchPagedNFTs, currentPage]);

  // Helper function to fetch basic token data (owner, tokenURI)
  const fetchBasicTokenData = async (
    collection: string,
    tokenId: number,
    publicClient: PublicClient,
    isExternal: boolean // Pass isExternal flag
  ): Promise<NFTItem | null> => {
    try {
      // Determine ABI based on whether it's external
      const abi = isExternal
        ? (await import("@/contracts/ExternalERC721.json")).abi
        : CollectionABI.abi;

      // Fetch owner first to check if token exists
      const owner = await publicClient.readContract({
        address: collection as `0x${string}`,
        abi,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      });

      // If ownerOf succeeds, fetch tokenURI
      const tokenURI = await publicClient.readContract({
        address: collection as `0x${string}`,
        abi,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });

      return {
        tokenId,
        tokenURI: tokenURI as string,
        owner: owner as string,
        metadata: undefined, // Will be fetched in batches later
        listing: undefined, // Will be fetched in batches later
        collection,
      };
    } catch (err) {
      // If ownerOf fails, the token likely doesn't exist or there was an error
      // Log it but return null so it gets filtered out
      if (
        err instanceof Error &&
        err.message.includes("owner query for nonexistent token")
      ) {
        // Expected error for non-existent tokens in sequential check, don't spam console
      } else {
        console.error(
          `Error fetching basic data for token ${tokenId} in ${collection}:`,
          err
        );
      }
      return null;
    }
  };

  // Function to fetch metadata and listings in batches - modify to check for existing listings
  const fetchMetadataAndListingsInBatches = async (
    tokens: NFTItem[],
    publicClient: PublicClient
  ) => {
    setMetadataLoading(true);

    // Process in batches of 25 to avoid overloading the API
    const BATCH_SIZE = 25;
    const batches = Math.ceil(tokens.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, tokens.length);
      const batchTokens = tokens.slice(start, end);

      console.log(
        `Processing metadata batch ${i + 1}/${batches} (tokens ${start} to ${
          end - 1
        })`
      );

      // Collect all tokenURIs for this batch
      const validTokens = batchTokens.filter(
        (token) => token && token.tokenURI
      );
      const tokenURIs = validTokens.map((token) => token.tokenURI);

      // Skip if no valid tokens in this batch
      if (tokenURIs.length === 0) {
        console.log(
          `Batch ${i + 1} has no valid token URIs, skipping metadata fetch.`
        );
        continue;
      }

      try {
        // Fetch metadata for all tokens in this batch at once
        const metadataMap = await fetchBatchMetadataFromIPFS(tokenURIs);

        // Create metadata results array from the batch response
        const metadataResults = validTokens
          .map((token) => {
            if (!token) return null;
            const metadata = metadataMap[token.tokenURI];
            return metadata ? { tokenId: token.tokenId, metadata } : null;
          })
          .filter(Boolean);

        // Fetch listing info only for tokens that don't already have a listing from DB
        const tokensWithoutListings = batchTokens.filter(
          (token) => !token.listing
        );

        const listingPromises = tokensWithoutListings.map(async (token) => {
          if (!token) return null; // Skip if token is null
          try {
            // Try to get the listing from database first (optional extra check)
            try {
              const dbListing = await getListing(
                token.collection,
                token.tokenId
              );
              if (dbListing) {
                return {
                  tokenId: token.tokenId,
                  listing: {
                    active: true,
                    price: dbListing.price,
                    seller: dbListing.seller,
                  },
                };
              }
            } catch (dbError) {
              // If database query fails (404 or other error), continue to blockchain check
              // This is expected with a fresh database with no listings
              console.log(
                `No database listing found for token ${token.tokenId}, checking blockchain...`
              );
            }

            // The listing will have a structure matching the Listing struct in the contract
            interface MarketplaceListing {
              seller: string;
              nftContract: string;
              tokenId: bigint;
              price: bigint;
              isPrivate: boolean;
              allowedBuyer: string;
              status: number; // 0=None, 1=Active, 2=Sold, 3=Canceled
            }

            const listingData = (await publicClient.readContract({
              address: MARKETPLACE_ADDRESS as `0x${string}`,
              abi: MarketplaceABI.abi,
              functionName: "getListing",
              args: [token.collection as `0x${string}`, BigInt(token.tokenId)],
            })) as MarketplaceListing;

            // Status 1 = Active in the ListingStatus enum
            const isActive = listingData.status === 1;

            if (isActive) {
              // Store blockchain listing in database too for future queries
              try {
                await createListing(
                  listingData.seller,
                  token.collection,
                  token.tokenId,
                  formatEther(listingData.price),
                  true, // isPrivate - depends on listing data structure, adjust if needed
                  listingData.isPrivate ? listingData.allowedBuyer : null,
                  null, // No transaction hash for historical records
                  null // No block number for historical records
                );
                console.log(
                  `Synced on-chain listing for token ${token.tokenId} to database`
                );
              } catch (syncError) {
                console.error(`Error syncing listing to database:`, syncError);
                // Continue even if database sync fails
              }

              return {
                tokenId: token.tokenId,
                listing: {
                  active: true,
                  price: formatEther(listingData.price),
                  seller: listingData.seller,
                },
              };
            }
            return null; // Not listed or not active
          } catch (err) {
            // If getListing fails (e.g., contract doesn't exist?), log and return null
            console.error(
              `Error fetching listing for token ${token.tokenId} in ${token.collection}:`,
              err
            );
            return null;
          }
        });

        const listingResults = (await Promise.all(listingPromises)).filter(
          Boolean
        );

        // Update the NFTs with the new metadata and listing info
        setNfts((prevNfts) => {
          const newNftsMap = new Map(prevNfts.map((nft) => [nft.tokenId, nft]));

          // Update metadata
          metadataResults.forEach((result) => {
            if (!result) return;
            const existingNft = newNftsMap.get(result.tokenId);
            if (existingNft) {
              newNftsMap.set(result.tokenId, {
                ...existingNft,
                metadata: result.metadata,
              });
            }
          });

          // Update listings
          listingResults.forEach((result) => {
            if (!result) return;
            const existingNft = newNftsMap.get(result.tokenId);
            if (existingNft) {
              newNftsMap.set(result.tokenId, {
                ...existingNft,
                listing: result.listing,
              });
            }
          });

          // Sort the NFTs by token ID to maintain a stable order in the UI
          return Array.from(newNftsMap.values()).sort(
            (a, b) => Number(a.tokenId) - Number(b.tokenId)
          );
        });
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
      } finally {
        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setMetadataLoading(false);
    console.log("Completed fetching metadata and listings for current page");
  };

  // Clean up and return paginated interface
  return {
    nfts,
    loading,
    metadataLoading,
    error,
    currentPage,
    totalPages,
    totalTokens,
    pageSize,
    nextPage,
    prevPage,
    goToPage,
    setPageSize: setPageSizeAndRefetch,
    refresh,
  };
}

// Hook for updating a collection
export function useUpdateCollection(collectionAddress: string) {
  const { address } = useAccount();
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });

  const updateCollection = async (
    name: string,
    contractURI: string,
    mintPrice: number,
    royaltyFee: number
  ) => {
    if (!address) throw new Error("Wallet not connected");

    console.log(`Updating collection with royaltyFee: ${royaltyFee}`); // Using param to avoid linter error

    // Update collection URI
    await writeContract({
      address: collectionAddress as `0x${string}`,
      abi: CollectionABI.abi,
      functionName: "setContractURI",
      args: [contractURI],
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

// Hook for canceling an NFT listing
export function useCancelListing() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const cancelListing = async (nftContract: string, tokenId: number) => {
    if (!address || !walletClient || !publicClient)
      throw new Error("Wallet not connected");

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
    setTxHash(null);

    try {
      console.log(
        `Canceling listing for contract ${nftContract}, token ${tokenId}...`
      );

      // First check if the listing exists in our database
      try {
        const dbListing = await getListing(nftContract, tokenId);
        if (dbListing && dbListing.status !== 1) {
          console.log(
            `Listing already has status ${dbListing.status} in database, no need to cancel`
          );
          setIsSuccess(true);
          setIsLoading(false);
          return true;
        }
      } catch (dbError) {
        console.warn("Could not check database listing status:", dbError);
        // Continue anyway
      }

      // Next verify if the listing exists on chain
      try {
        interface MarketplaceListing {
          seller: string;
          nftContract: string;
          tokenId: bigint;
          price: bigint;
          isPrivate: boolean;
          allowedBuyer: string;
          status: number; // 0=None, 1=Active, 2=Sold, 3=Canceled
        }

        const listingData = (await publicClient.readContract({
          address: MARKETPLACE_ADDRESS as `0x${string}`,
          abi: MarketplaceABI.abi,
          functionName: "getListing",
          args: [nftContract as `0x${string}`, BigInt(tokenId)],
        })) as MarketplaceListing;

        console.log("listing data from blockchain", listingData);
        // Check if the listing is active before trying to cancel
        if (listingData.status !== 1) {
          console.log(
            `Listing for token ${tokenId} has status ${listingData.status} on blockchain, no need to cancel`
          );

          // Sync database with blockchain state
          try {
            // First try updating the status
            const updateResult = await updateListingStatus(
              nftContract,
              tokenId,
              listingData.status, // Use the actual blockchain status
              null,
              null
            );

            if (updateResult) {
              console.log(
                `Synced listing status to ${listingData.status} in database`
              );
            } else {
              console.warn(
                "Failed to update listing status in database, clearing instead"
              );
              // If update fails, try clearing and re-creating with correct status
              await clearListing(nftContract, tokenId);
              console.log(`Cleared old listing from database`);
            }
          } catch (dbError) {
            console.error("Error syncing listing status:", dbError);
          }

          // Not an error condition, just already done
          setIsSuccess(true);
          setIsLoading(false);
          return true;
        }
      } catch (readError) {
        console.error("Error checking listing status on chain:", readError);
        // Continue with cancel attempt anyway
      }

      // Get the next nonce
      const nonce = await publicClient.getTransactionCount({
        address,
        blockTag: "pending",
      });

      // Get marketplace contract
      const marketplaceContract = await getMarketplaceContract();

      // Call the contract's cancelListing function with proper gas settings and nonce
      const tx = await marketplaceContract.cancelListing(nftContract, tokenId, {
        gasPrice: 9,
        gasLimit: 3000000,
        nonce: nonce,
      });

      setTxHash(tx.hash);
      console.log(`Cancellation transaction submitted: ${tx.hash}`);

      // Wait for transaction to complete
      console.log("Waiting for cancellation confirmation...");
      const receipt = await tx.wait();
      console.log(`Cancellation confirmed in block ${receipt.blockNumber}`);

      // Update listing status in database (status 3 = Canceled)
      try {
        console.log("now updating listing status in database");
        const updateResult = await updateListingStatus(
          nftContract,
          tokenId,
          3, // 3 = Canceled status
          tx.hash,
          BigInt(receipt.blockNumber)
        );

        if (updateResult) {
          console.log(
            "Listing status updated to 'Canceled' in database successfully"
          );
        } else {
          console.warn(
            "Database update failed, trying to clear listing instead"
          );

          // If update fails, try clearing the listing completely
          const clearResult = await clearListing(nftContract, tokenId);
          console.log(
            `Cleared listing from database instead: ${JSON.stringify(
              clearResult
            )}`
          );
        }
      } catch (dbError) {
        console.error("Error updating listing status in database:", dbError);
        // Try clearing as a fallback
        try {
          await clearListing(nftContract, tokenId);
          console.log("Cleared listing from database as fallback");
        } catch (clearError) {
          console.error("Failed to clear listing:", clearError);
        }
      }

      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Error canceling listing:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to cancel listing")
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    cancelListing,
    isLoading,
    isSuccess,
    error,
    txHash,
  };
}
