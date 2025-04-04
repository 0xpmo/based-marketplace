// hooks/useERC1155Contracts.ts
import { getActiveChain } from "@/config/chains";
import { ERC1155_CONTRACT_ADDRESSES } from "@/constants/addresses";
import { fetchBatchMetadataFromIPFS, fetchFromIPFS } from "@/services/ipfs";
import {
  CharacterInfo,
  CollectionMetadata,
  ERC1155Collection,
  ERC1155Item,
  KekTrumpsRarity,
} from "@/types/contracts";
import { useCallback, useEffect, useState } from "react";
import { createPublicClient, formatEther, http, parseEther } from "viem";
import {
  useAccount,
  useConfig,
  usePublicClient,
  useTransaction,
  useWriteContract,
} from "wagmi";
import { switchChain } from "wagmi/actions";

// Import ABIs
import KekTrumpsABI from "@/contracts/KekTrumps.json";
import {
  isERC1155Collection,
  isERC1155CollectionAddress,
} from "@/utils/collectionTypeDetector";

// Define Character interface for type safety
interface Character {
  characterId: bigint;
  name: string;
  enabled: boolean;
}

// Hook for fetching ERC1155 collections
export function useERC1155Collections() {
  const [collections, setCollections] = useState<ERC1155Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchERC1155Collections = useCallback(async () => {
    if (ERC1155_CONTRACT_ADDRESSES.length === 0) {
      console.log("No ERC1155 collections configured");
      setCollections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const collectionsData: ERC1155Collection[] = [];

      for (const contractAddress of ERC1155_CONTRACT_ADDRESSES) {
        try {
          // Create client for reading contract data
          const publicClient = createPublicClient({
            chain: getActiveChain(),
            transport: http(),
          });

          // Read basic contract info
          const name = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "name",
          });

          const symbol = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "symbol",
          });

          const contractURI = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "contractURI",
          });

          const owner = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "owner",
          });

          // Get contract metadata from IPFS
          let metadata;
          try {
            metadata = await fetchFromIPFS(contractURI as string);
          } catch (err) {
            console.error(
              `Failed to fetch metadata for collection ${contractAddress}`,
              err
            );
            metadata = null;
          }

          // Get rarity prices
          const rarityPrices: { [key: number]: string } = {};
          for (let i = 0; i < 4; i++) {
            // Bronze, Silver, Gold, Green
            try {
              const price = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: KekTrumpsABI.abi,
                functionName: "rarityPrices",
                args: [i],
              });

              rarityPrices[i] = formatEther(BigInt(price as string));
            } catch (err) {
              console.error(`Failed to get price for rarity ${i}:`, err);
              rarityPrices[i] = "0";
            }
          }

          // Get max mint per transaction limits
          const maxMintPerTx: { [key: number]: number } = {};
          for (let i = 0; i < 4; i++) {
            try {
              const limit = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: KekTrumpsABI.abi,
                functionName: "maxMintPerTx",
                args: [i],
              });

              maxMintPerTx[i] = Number(limit);
            } catch (err) {
              console.error(
                `Failed to get max mint limit for rarity ${i}:`,
                err
              );
              maxMintPerTx[i] = 10; // Default value
            }
          }

          // Get available characters
          const characters = [];
          let characterId = 1;
          let totalSupply = BigInt(0);

          try {
            totalSupply = (await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "totalSupply",
            })) as bigint;
          } catch (err) {
            console.error(`Failed to get total supply:`, err);
          }

          while (characterId <= 10) {
            try {
              const character = (await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: KekTrumpsABI.abi,
                functionName: "getCharacter",
                args: [characterId],
              })) as CharacterInfo;

              if (character && character.characterId !== undefined) {
                characters.push({
                  characterId: Number(character.characterId),
                  name: character.name,
                  enabled: character.enabled,
                });
                characterId++;
              } else {
                break; // No more characters
              }
            } catch (err) {
              // If character doesn't exist, just continue to next one
              characterId++;
              continue;
            }
          }

          // Check if contract is paused
          let mintingEnabled = true;
          try {
            const paused = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "paused",
            });
            mintingEnabled = !(paused as boolean);
          } catch (err) {
            console.error(`Failed to check if contract is paused:`, err);
          }

          // Get royalty information
          let royaltyFee = 0;
          try {
            const royaltyInfo = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "royaltyInfo",
              args: [0, 10000], // Sample values
            });

            if (
              royaltyInfo &&
              Array.isArray(royaltyInfo) &&
              royaltyInfo.length > 1
            ) {
              royaltyFee = Number(royaltyInfo[1]) / 100; // Convert basis points to percentage
            }
          } catch (err) {
            console.error(`Failed to get royalty info:`, err);
          }

          collectionsData.push({
            address: contractAddress as string,
            name: (name as string) || "Unnamed ERC1155 Collection",
            symbol: (symbol as string) || "ERC1155",
            contractURI: (contractURI as string) || "",
            mintPrice: Object.values(rarityPrices)[0] || "0",
            totalSupply: Number(totalSupply),
            royaltyFee,
            owner: owner as string,
            metadata: metadata as unknown as CollectionMetadata,
            mintingEnabled,
            source: "external",
            isERC1155: true,
            characters,
            rarityPrices,
            maxMintPerTx,
          });
        } catch (err) {
          console.error(
            `Error fetching details for ERC1155 collection ${contractAddress}:`,
            err
          );
          // Continue with next collection instead of failing completely
        }
      }

      setCollections(collectionsData);
      setError(null);
    } catch (err) {
      console.error("Error fetching ERC1155 collections:", err);
      setError("Failed to fetch ERC1155 collections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchERC1155Collections();
  }, [fetchERC1155Collections]);

  const refreshCollections = useCallback(() => {
    fetchERC1155Collections();
  }, [fetchERC1155Collections]);

  return { collections, loading, error, refreshCollections };
}

// Hook for minting ERC1155 tokens
export function useMintERC1155(collectionAddress: string) {
  const { address, chainId } = useAccount();
  const { writeContract, data: txHash, isError, error } = useWriteContract();
  const { isLoading: txLoading, isSuccess } = useTransaction(
    txHash ? { hash: txHash } : {}
  );
  const isLoading = !!txHash && txLoading;
  const publicClient = usePublicClient();
  const config = useConfig();
  const targetChainId = getActiveChain().id;

  const mintERC1155 = async (
    rarityType: KekTrumpsRarity,
    amount: number,
    price: string
  ) => {
    if (!address) throw new Error("Wallet not connected");
    if (!publicClient) throw new Error("No provider available");

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

    try {
      // Get maxMintPerTx for this rarity
      const maxMintPerTx = (await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "maxMintPerTx",
        args: [rarityType],
      })) as number;

      // Validate amount against maxMintPerTx
      if (amount <= 0 || amount > maxMintPerTx) {
        throw new Error(
          `Can only mint between 1 and ${maxMintPerTx} tokens at a time for this rarity`
        );
      }

      // Check if contract is paused
      const paused = (await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "paused",
      })) as boolean;

      if (paused) {
        throw new Error("Minting is currently paused");
      }

      // Calculate total price
      const totalPrice = parseEther((parseFloat(price) * amount).toString());
      await writeContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "mint",
        args: [address, rarityType, amount],
        value: totalPrice,
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
    mintERC1155,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash,
  };
}

export function useERC1155CollectionTokens(collectionAddress: string) {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<ERC1155Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllTokens = useCallback(async () => {
    if (!collectionAddress) {
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

      const allTokens: ERC1155Item[] = [];

      // Iterate through all possible character IDs (1-10 based on contract)
      for (let characterId = 1; characterId <= 10; characterId++) {
        try {
          // Get character info for each character
          const characterInfo = (await publicClient.readContract({
            address: collectionAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "getCharacter",
            args: [characterId],
          })) as CharacterInfo;

          // Skip if character is not enabled
          if (!characterInfo.enabled) continue;

          // Check each rarity for this character
          for (let rarity = 0; rarity < 4; rarity++) {
            // Only process if tokens have been minted for this rarity
            if (characterInfo.minted[rarity] > 0) {
              const tokenId = characterInfo.tokenId[rarity];

              // Get token URI
              const uri = (await publicClient.readContract({
                address: collectionAddress as `0x${string}`,
                abi: KekTrumpsABI.abi,
                functionName: "uri",
                args: [tokenId],
              })) as string;

              // Get current circulating supply
              const supply = (await publicClient.readContract({
                address: collectionAddress as `0x${string}`,
                abi: KekTrumpsABI.abi,
                functionName: "circulatingSupply",
                args: [tokenId],
              })) as bigint;

              // Only add token if it has circulating supply
              if (Number(supply) > 0) {
                // Get user balance if connected
                let balance = 0;
                if (address) {
                  try {
                    const userBalance = (await publicClient.readContract({
                      address: collectionAddress as `0x${string}`,
                      abi: KekTrumpsABI.abi,
                      functionName: "balanceOf",
                      args: [address, tokenId],
                    })) as bigint;
                    balance = Number(userBalance);
                  } catch (err) {
                    console.error(
                      `Failed to get balance for token ${tokenId}:`,
                      err
                    );
                  }
                }

                allTokens.push({
                  tokenId: Number(tokenId),
                  characterId,
                  rarity,
                  uri,
                  supply: Number(supply),
                  maxSupply: Number(characterInfo.maxSupply[rarity]),
                  balance,
                  collection: collectionAddress,
                  metadata: undefined, // Will be fetched separately
                });
              }
            }
          }
        } catch (err) {
          // If character doesn't exist, just continue to next one
          continue;
        }
      }

      // Sort tokens by character ID and rarity
      const sortedTokens = allTokens.sort((a, b) => {
        const aCharId = a.characterId ?? 0;
        const bCharId = b.characterId ?? 0;
        if (aCharId !== bCharId) {
          return aCharId - bCharId;
        }
        return (a.rarity ?? 0) - (b.rarity ?? 0);
      });

      setTokens(sortedTokens);
      setError(null);

      // Fetch metadata in background
      fetchMetadataForTokens(sortedTokens);
    } catch (err) {
      console.error("Error fetching ERC1155 tokens:", err);
      setError("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, [collectionAddress, address]);

  // Separate function to fetch metadata
  const fetchMetadataForTokens = async (tokens: ERC1155Item[]) => {
    const BATCH_SIZE = 10;
    const batches = Math.ceil(tokens.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, tokens.length);
      const batchTokens = tokens.slice(start, end);

      try {
        const tokenURIs = batchTokens
          .map((token) => token.uri)
          .filter((uri): uri is string => uri !== undefined);

        if (tokenURIs.length === 0) continue;

        const metadataMap = await fetchBatchMetadataFromIPFS(tokenURIs);

        setTokens((prevTokens) => {
          const newTokens = [...prevTokens];
          batchTokens.forEach((token) => {
            if (token.uri && metadataMap[token.uri]) {
              const tokenIndex = newTokens.findIndex(
                (t) => t.tokenId === token.tokenId
              );
              if (tokenIndex !== -1) {
                newTokens[tokenIndex] = {
                  ...newTokens[tokenIndex],
                  metadata: metadataMap[token.uri] || undefined,
                };
              }
            }
          });
          return newTokens;
        });
      } catch (err) {
        console.error(`Error fetching metadata batch ${i}:`, err);
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  useEffect(() => {
    fetchAllTokens();
  }, [fetchAllTokens]);

  return {
    tokens,
    loading,
    error,
    refresh: fetchAllTokens,
  };
}

// Hook for getting individual ERC1155 token details
export function useERC1155Token(collectionAddress: string, tokenId: number) {
  const { address } = useAccount();
  const [token, setToken] = useState<ERC1155Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    if (!collectionAddress || tokenId === undefined) {
      setToken(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const publicClient = createPublicClient({
        chain: getActiveChain(),
        transport: http(),
      });

      // Get character ID and rarity from token ID
      // In KekTrumps, tokenId = characterId * 10 + rarity
      const characterId = Math.floor(tokenId / 10);
      const rarity = tokenId % 10;

      // Get character info which includes all the details we need
      const characterInfo = (await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "getCharacter",
        args: [characterId],
      })) as CharacterInfo;

      if (!characterInfo) {
        throw new Error("Invalid token - character not found");
      }

      // Get token URI
      const uri = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "uri",
        args: [tokenId],
      });

      // Get circulating supply for this token
      const supply = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "circulatingSupply",
        args: [tokenId],
      });

      console.log("fish  supply", supply);

      // Get user's balance if connected
      let balance = 0;
      if (address) {
        try {
          const userBalance = await publicClient.readContract({
            address: collectionAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "balanceOf",
            args: [address, tokenId],
          });

          balance = Number(userBalance);
        } catch (err) {
          console.error(`Failed to get balance for token ${tokenId}:`, err);
        }
      }

      // Fetch metadata
      let metadata;
      if (uri) {
        try {
          metadata = await fetchFromIPFS(uri as string);
        } catch (err) {
          console.error(`Failed to fetch metadata for token ${tokenId}`, err);
        }
      }

      setToken({
        tokenId,
        characterId,
        rarity,
        uri: uri as string,
        metadata,
        supply: Number(supply),
        maxSupply: Number(characterInfo.maxSupply[rarity]),
        balance,
        collection: collectionAddress,
        listing: undefined, // Marketplace integration placeholder
      });

      setError(null);
    } catch (err) {
      console.error(`Error fetching ERC1155 token ${tokenId}:`, err);
      setError("Failed to load token details");
    } finally {
      setLoading(false);
    }
  }, [collectionAddress, tokenId, address]);

  useEffect(() => {
    fetchToken();
  }, [fetchToken, collectionAddress, tokenId, address]);

  return {
    token,
    loading,
    error,
    refresh: fetchToken,
  };
}

// Hook for getting a single ERC1155 collection
export function useERC1155Collection(collectionAddress: string) {
  const [collection, setCollection] = useState<ERC1155Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollection = useCallback(async () => {
    if (!collectionAddress) {
      setCollection(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Create client for reading contract data
      const publicClient = createPublicClient({
        chain: getActiveChain(),
        transport: http(),
      });

      // Read basic contract info
      const name = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "name",
      });

      const symbol = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "symbol",
      });

      const contractURI = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "contractURI",
      });

      const owner = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "owner",
      });

      // Get contract metadata from IPFS
      let metadata;
      try {
        metadata = await fetchFromIPFS(contractURI as string);
      } catch (err) {
        console.error(
          `Failed to fetch metadata for collection ${collectionAddress}`,
          err
        );
        metadata = null;
      }

      // Get rarity prices
      const rarityPrices: { [key: number]: string } = {};
      for (let i = 0; i < 4; i++) {
        // Bronze, Silver, Gold, Green
        try {
          const price = await publicClient.readContract({
            address: collectionAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "rarityPrices",
            args: [i],
          });

          rarityPrices[i] = formatEther(BigInt(price as string));
        } catch (err) {
          console.error(`Failed to get price for rarity ${i}:`, err);
          rarityPrices[i] = "0";
        }
      }

      // Get max mint per transaction limits
      const maxMintPerTx: { [key: number]: number } = {};
      for (let i = 0; i < 4; i++) {
        try {
          const limit = await publicClient.readContract({
            address: collectionAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "maxMintPerTx",
            args: [i],
          });

          maxMintPerTx[i] = Number(limit);
        } catch (err) {
          console.error(`Failed to get max mint limit for rarity ${i}:`, err);
          maxMintPerTx[i] = 10; // Default value
        }
      }

      // Get available characters
      const characters = [];
      let characterId = 1;
      let totalSupply = BigInt(0);

      try {
        totalSupply = (await publicClient.readContract({
          address: collectionAddress as `0x${string}`,
          abi: KekTrumpsABI.abi,
          functionName: "totalSupply",
        })) as bigint;
      } catch (err) {
        console.error(`Failed to get total supply:`, err);
      }

      while (characterId <= 10) {
        try {
          const character = (await publicClient.readContract({
            address: collectionAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "getCharacter",
            args: [characterId],
          })) as CharacterInfo;

          if (character && character.characterId !== undefined) {
            characters.push({
              characterId: Number(character.characterId),
              name: character.name,
              enabled: character.enabled,
            });
            characterId++;
          } else {
            break; // No more characters
          }
        } catch (err) {
          // If character doesn't exist, just continue to next one
          characterId++;
          continue;
        }
      }

      // Get any royalty information
      let formattedRoyaltyFee = 0;
      try {
        const royaltyFee = await publicClient.readContract({
          address: collectionAddress as `0x${string}`,
          abi: KekTrumpsABI.abi,
          functionName: "royaltyInfo",
          args: [0, 10000], // Sample values
        });

        // Extract royalty fee from royaltyInfo if it's in that format
        if (royaltyFee) {
          if (Array.isArray(royaltyFee) && royaltyFee.length > 1) {
            // Handle royaltyInfo [address, amount] tuple format
            formattedRoyaltyFee = Number(royaltyFee[1]);
          } else {
            // Handle direct royaltyFee format
            formattedRoyaltyFee = Number(royaltyFee);
          }
        }
      } catch (err) {
        console.error(`Failed to get royalty info:`, err);
      }
      let mintingEnabled = true;
      const paused = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "paused",
      });

      mintingEnabled = !(paused as boolean);

      setCollection({
        address: collectionAddress,
        name: (name as string) || "Unnamed ERC1155 Collection",
        symbol: (symbol as string) || "ERC1155",
        contractURI: (contractURI as string) || "",
        mintPrice: Object.values(rarityPrices)[0] || "0", // Default mint price
        totalSupply: Number(totalSupply),
        royaltyFee: formattedRoyaltyFee,
        owner: owner as string,
        metadata: metadata as unknown as CollectionMetadata,
        mintingEnabled,
        source: "external",
        isERC1155: true,
        characters,
        rarityPrices,
        maxMintPerTx,
      });

      setError(null);
    } catch (err) {
      console.error(
        `Error fetching ERC1155 collection ${collectionAddress}:`,
        err
      );
      setError("Failed to fetch collection details");
    } finally {
      setLoading(false);
    }
  }, [collectionAddress]);

  useEffect(() => {
    if (collectionAddress && isERC1155CollectionAddress(collectionAddress)) {
      console.log("fetching collection blobber");
      fetchCollection();
    } else {
      setLoading(false);
    }
  }, [collectionAddress, fetchCollection]);

  return { collection, loading, error, refresh: fetchCollection };
}
