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

// Combined hook that fetches both based and external collections
// export function useCollections() {
//   // Copy implementation from existing useCollections
//   // ...
// }

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
