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

// Import ABIs (you'll need to generate these from your compiled contracts)
import FactoryABI from "@/contracts/BasedSeaCollectionFactory.json";
import CollectionABI from "@/contracts/BasedSeaSequentialNFTCollection.json";
import MarketplaceABI from "@/contracts/BasedSeaMarketplace.json";
import KekTrumpsABI from "@/contracts/KekTrumps.json";

// UPDATE WITH PRODUCTION ADDRESS
const KEKTRUMPS_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

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

          // Fetch basic collection details - similar to factory collections
          const name =
            externalCollection.name ||
            (await readCollectionProperty(address, "name", true));
          const symbol = await readCollectionProperty(address, "symbol", true);
          const contractURI = await readCollectionProperty(
            address,
            "contractURI",
            true
          );

          // Some external collections might not have all the same properties
          // So we handle them differently to be more resilient
          let mintPrice,
            maxSupply,
            totalMinted,
            royaltyFee,
            owner,
            mintingEnabled;

          try {
            mintPrice = await readCollectionProperty(
              address,
              "mintPrice",
              true
            );
          } catch (e) {
            console.log(`Collection ${address} doesn't have mintPrice`);
            mintPrice = 0;
          }

          try {
            maxSupply = await readCollectionProperty(
              address,
              "maxSupply",
              true
            );
          } catch (e) {
            console.log(`Collection ${address} doesn't have maxSupply`);
            maxSupply = 0;
          }

          try {
            totalMinted =
              (await readCollectionProperty(address, "totalSupply", true)) ||
              (await readCollectionProperty(address, "totalMinted", true));
          } catch (e) {
            console.log(
              `Collection ${address} doesn't have totalSupply/totalMinted`
            );
            totalMinted = 0;
          }

          try {
            royaltyFee =
              (await readCollectionProperty(address, "royaltyFee", true)) ||
              (await readCollectionProperty(
                address,
                "royaltyInfo",
                true,
                [0, 10000]
              ));

            // If royaltyInfo was returned, extract the royalty fee from it
            if (
              royaltyFee &&
              Array.isArray(royaltyFee) &&
              royaltyFee.length > 1
            ) {
              royaltyFee = royaltyFee[1];
            }
          } catch (e) {
            console.log(`Collection ${address} doesn't have royalty info`);
            royaltyFee = 0;
          }

          try {
            owner = await readCollectionProperty(address, "owner", true);
          } catch (e) {
            console.log(`Collection ${address} doesn't have owner method`);
            owner = "0x0000000000000000000000000000000000000000";
          }

          try {
            mintingEnabled = await readCollectionProperty(
              address,
              "mintingEnabled",
              true
            );
          } catch (e) {
            console.log(`Collection ${address} doesn't have mintingEnabled`);
            mintingEnabled = false;
          }

          // Fetch metadata from IPFS or other URI
          let metadata = undefined;
          try {
            if (contractURI) {
              metadata = await fetchFromIPFS(contractURI as string);
            }
          } catch (err) {
            console.error(
              `Failed to fetch metadata for collection ${address}`,
              err
            );
          }

          // Format values and handle possible missing properties
          const formattedMintPrice = mintPrice
            ? formatEther(BigInt(mintPrice.toString()))
            : "0";
          const formattedMaxSupply = maxSupply ? Number(maxSupply) : 0;
          const formattedTotalMinted = totalMinted ? Number(totalMinted) : 0;
          const formattedRoyaltyFee = royaltyFee ? Number(royaltyFee) : 0;

          // Check if this is a manually deployed BasedNFT contract
          const isManualBasedContract =
            externalCollection.isBasedContract === true;

          collectionsData.push({
            address,
            name: (name as string) || "Unknown Collection",
            symbol: (symbol as string) || "UNKNOWN",
            contractURI: (contractURI as string) || "",
            mintPrice: formattedMintPrice,
            maxSupply: formattedMaxSupply,
            totalMinted: formattedTotalMinted,
            royaltyFee: formattedRoyaltyFee,
            owner: owner as string,
            metadata: metadata as unknown as CollectionMetadata,
            mintingEnabled: mintingEnabled as boolean,
            source: isManualBasedContract ? "based" : "external", // Use "based" source for manually deployed BasedNFT contracts
          });
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
  const {
    collections: basedCollections,
    loading: basedLoading,
    error: basedError,
    refreshCollections: refreshBasedCollections,
  } = useBasedCollections();

  const {
    collections: externalCollections,
    loading: externalLoading,
    error: externalError,
    refreshCollections: refreshExternalCollections,
  } = useExternalCollections();

  // Combine the collections with based collections coming first
  const collections = useMemo(() => {
    return [...basedCollections, ...externalCollections];
  }, [basedCollections, externalCollections]);

  const loading = basedLoading || externalLoading;
  const error = basedError || externalError;

  const refreshCollections = useCallback(() => {
    refreshBasedCollections();
    refreshExternalCollections();
  }, [refreshBasedCollections, refreshExternalCollections]);

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
        // The file should be named with the contract address (without 0x prefix)
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
          abi = (await import("@/contracts/ExternalERC721.json")).abi;
          console.log(
            `Using generic ERC721 ABI for collection ${collectionAddress}`
          );
        }
      }
    } else {
      // For factory collections, always use the BasedNFT ABI
      abi = CollectionABI.abi;
    }

    const data = await publicClient.readContract({
      address: collectionAddress as `0x${string}`,
      abi,
      functionName: propertyName,
      args,
    });

    return data;
  } catch (err) {
    console.error(`Error reading ${propertyName} from collection`, err);
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

      // Call the contract's listItem function
      // const tx = await marketplaceContract.listItem(
      //   collectionAddress,
      //   tokenId,
      //   priceInWei, {
      //     gasPrice: 9,
      //     gasLimit: 3000000,
      //     nonce: await provider.getTransactionCount(userAddress, "pending")  // Critical for proper nonce management
      //   };
      //   }
      // );
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
  // const { writeContract, data, isError, error } = useWriteContract();
  // const { isLoading, isSuccess } = useTransaction({ hash: data });

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
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });

  const createPrivateListing = async (
    nftContract: string,
    tokenId: number,
    price: string,
    allowedBuyer: string
  ) => {
    if (!address) throw new Error("Wallet not connected");

    const priceInWei = parseEther(price);

    writeContract({
      address: MARKETPLACE_ADDRESS as `0x${string}`,
      abi: MarketplaceABI.abi,
      functionName: "createPrivateListing",
      args: [
        nftContract as `0x${string}`,
        BigInt(tokenId),
        priceInWei,
        allowedBuyer as `0x${string}`,
      ],
    });
  };

  return {
    createPrivateListing,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash: data,
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
        const mintPrice = await readCollectionProperty(
          collectionAddress,
          "mintPrice",
          isExternal
        );
        const maxSupply = await readCollectionProperty(
          collectionAddress,
          "MAX_SUPPLY",
          isExternal
        );
        const totalMinted =
          (await readCollectionProperty(
            collectionAddress,
            "totalMinted",
            isExternal
          )) ||
          (await readCollectionProperty(
            collectionAddress,
            "totalSupply",
            isExternal
          ));

        const royaltyFee = await readCollectionProperty(
          collectionAddress,
          "royaltyInfo",
          isExternal,
          [0, 10000]
        );

        // Extract royalty fee from royaltyInfo if it's in that format
        let formattedRoyaltyFee = 0;
        if (royaltyFee) {
          if (Array.isArray(royaltyFee) && royaltyFee.length > 1) {
            // Handle royaltyInfo [address, amount] tuple format
            formattedRoyaltyFee = Number(royaltyFee[1]);
          } else {
            // Handle direct royaltyFee format
            formattedRoyaltyFee = Number(royaltyFee);
          }
        }
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

        // Fetch metadata from IPFS
        let metadata = undefined;
        try {
          metadata = await fetchFromIPFS(contractURI as string);
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

        setCollection({
          address: collectionAddress,
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

// Hook for fetching NFTs in a collection - fetches ALL NFTs at once
export function useCollectionNFTs(collectionAddress: string) {
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);

  // Fetch all NFTs for the collection at once
  const fetchAllNFTs = useCallback(async () => {
    if (!collectionAddress) {
      console.log("No collection address, skipping fetch");
      return;
    }

    console.log(`Fetching all NFTs for collection ${collectionAddress}`);
    setLoading(true);

    try {
      // Create the public client
      const publicClient = createPublicClient({
        chain: getActiveChain(),
        transport: http(),
      });

      // Get total supply/minted to determine the total number of tokens
      const totalSupply =
        (await readCollectionProperty(
          collectionAddress,
          "totalSupply",
          false
        )) ||
        (await readCollectionProperty(collectionAddress, "totalMinted", false));

      if (!totalSupply) {
        console.log("No total supply found");
        setLoading(false);
        return;
      }

      const totalTokens = Number(totalSupply);
      console.log(`Total tokens in collection: ${totalTokens}`);

      // Fetch all token IDs first
      const tokenIds: number[] = [];

      // Try using tokenByIndex (ERC721Enumerable) first
      let useTokenByIndex = true;
      try {
        // Test if tokenByIndex is supported
        await publicClient.readContract({
          address: collectionAddress as `0x${string}`,
          abi: CollectionABI.abi,
          functionName: "tokenByIndex",
          args: [BigInt(0)],
        });
      } catch (err) {
        console.log(
          "tokenByIndex not supported, will try direct token ID access"
        );
        useTokenByIndex = false;
      }

      // Get all token IDs
      const tokenIdPromises: Promise<number | null>[] = [];

      if (useTokenByIndex) {
        // Use tokenByIndex for ERC721Enumerable collections
        for (let i = 0; i < totalTokens; i++) {
          tokenIdPromises.push(
            (async (index) => {
              try {
                const tokenId = await publicClient.readContract({
                  address: collectionAddress as `0x${string}`,
                  abi: CollectionABI.abi,
                  functionName: "tokenByIndex",
                  args: [BigInt(index)],
                });
                return Number(tokenId);
              } catch (err) {
                console.error(`Error fetching token at index ${index}:`, err);
                return null;
              }
            })(i)
          );
        }
      } else {
        // Try sequential token IDs (0 to totalSupply-1)
        for (let i = 0; i < totalTokens; i++) {
          tokenIdPromises.push(
            (async (tokenId) => {
              try {
                // Check if token exists by trying to get its owner
                await publicClient.readContract({
                  address: collectionAddress as `0x${string}`,
                  abi: CollectionABI.abi,
                  functionName: "ownerOf",
                  args: [BigInt(tokenId)],
                });
                return tokenId;
              } catch (err) {
                // Token doesn't exist, skip
                return null;
              }
            })(i)
          );
        }
      }

      // Resolve all token ID promises
      const resolvedTokenIds = (await Promise.all(tokenIdPromises)).filter(
        (id) => id !== null
      ) as number[];

      console.log(`Found ${resolvedTokenIds.length} valid tokens`);

      // Fetch basic token data (owner, tokenURI) for all tokens
      const tokenDataPromises = resolvedTokenIds.map((tokenId) =>
        fetchBasicTokenData(collectionAddress, tokenId, publicClient)
      );

      const tokensWithBasicData = (await Promise.all(tokenDataPromises)).filter(
        Boolean
      ) as NFTItem[];
      console.log(
        `Fetched basic data for ${tokensWithBasicData.length} tokens`
      );

      // Update state with basic token data
      setNfts(tokensWithBasicData);
      setLoading(false);

      // Now fetch metadata and listings in batches
      fetchMetadataAndListingsInBatches(tokensWithBasicData, publicClient);
    } catch (err) {
      console.error("Error fetching collection NFTs:", err);
      setError("Failed to load NFTs. Please try again later.");
      setLoading(false);
    }
  }, [collectionAddress]);

  // Helper function to fetch basic token data
  const fetchBasicTokenData = async (
    collection: string,
    tokenId: number,
    publicClient: PublicClient
  ): Promise<NFTItem | null> => {
    try {
      // Fetch token URI
      const tokenURI = await publicClient.readContract({
        address: collection as `0x${string}`,
        abi: CollectionABI.abi,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });

      // Fetch owner
      const owner = await publicClient.readContract({
        address: collection as `0x${string}`,
        abi: CollectionABI.abi,
        functionName: "ownerOf",
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
      console.error(`Error fetching basic data for token ${tokenId}:`, err);
      return null;
    }
  };

  // Function to fetch metadata and listings in batches
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
      const validTokens = batchTokens.filter((token) => token.tokenURI);
      const tokenURIs = validTokens.map((token) => token.tokenURI);

      // Skip if no valid tokens in this batch
      if (tokenURIs.length === 0) {
        continue;
      }

      try {
        // Fetch metadata for all tokens in this batch at once
        const metadataMap = await fetchBatchMetadataFromIPFS(tokenURIs);

        // Create metadata results array from the batch response
        const metadataResults = validTokens
          .map((token) => {
            const metadata = metadataMap[token.tokenURI];
            return metadata ? { tokenId: token.tokenId, metadata } : null;
          })
          .filter(Boolean);

        // Fetch listing info for this batch
        const listingPromises = batchTokens.map(async (token) => {
          try {
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

            const isListed = (await publicClient.readContract({
              address: MARKETPLACE_ADDRESS as `0x${string}`,
              abi: MarketplaceABI.abi,
              functionName: "getListing",
              args: [token.collection as `0x${string}`, BigInt(token.tokenId)],
            })) as MarketplaceListing;

            if (isListed) {
              // Status 1 = Active in the ListingStatus enum
              const isActive = isListed.status === 1;

              if (isActive) {
                return {
                  tokenId: token.tokenId,
                  listing: {
                    active: true,
                    price: formatEther(isListed.price),
                    seller: isListed.seller,
                  },
                };
              }
            }
            return null;
          } catch (err) {
            console.error(
              `Error fetching listing for token ${token.tokenId}:`,
              err
            );
            return null;
          }
        });

        const listingResults = await Promise.all(listingPromises);

        // Update the NFTs with the new metadata and listing info
        setNfts((prevNfts) => {
          const newNfts = [...prevNfts];

          // Update metadata
          metadataResults.forEach((result) => {
            if (!result) return;
            const index = newNfts.findIndex(
              (n) => n.tokenId === result.tokenId
            );
            if (index !== -1) {
              newNfts[index] = {
                ...newNfts[index],
                metadata: result.metadata,
              };
            }
          });

          // Update listings
          listingResults.forEach((result) => {
            if (!result) return;
            const index = newNfts.findIndex(
              (n) => n.tokenId === result.tokenId
            );
            if (index !== -1) {
              newNfts[index] = {
                ...newNfts[index],
                listing: result.listing,
              };
            }
          });

          // Sort the NFTs by token ID to maintain a stable order in the UI
          return newNfts.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
        });
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setMetadataLoading(false);
    console.log("Completed fetching all metadata and listings");
  };

  // Fetch NFTs when the collection address changes
  useEffect(() => {
    if (collectionAddress) {
      fetchAllNFTs();
    } else {
      setNfts([]);
      setLoading(false);
      setError(null);
    }
  }, [collectionAddress, fetchAllNFTs]);

  return {
    nfts,
    loading,
    metadataLoading,
    error,
    refresh: fetchAllNFTs,
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
