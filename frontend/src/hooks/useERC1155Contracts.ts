// hooks/useERC1155Contracts.ts
import { getActiveChain } from "@/config/chains";
import { ERC1155_CONTRACT_ADDRESSES } from "@/constants/addresses";
import { fetchBatchMetadataFromIPFS, fetchFromIPFS } from "@/services/ipfs";
import {
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
import { isERC1155Collection } from "@/utils/collectionTypeDetector";

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

  // Debug logs
  useEffect(() => {
    console.log("ERC1155 Collection Addresses:", ERC1155_CONTRACT_ADDRESSES);
  }, []);

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
          let characterId = 0;

          // We'll try to fetch up to 100 characters (a reasonable upper limit)
          while (characterId < 100) {
            try {
              const character = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: KekTrumpsABI.abi,
                functionName: "characters",
                args: [characterId],
              });

              if (
                character &&
                (character as Character).characterId !== undefined
              ) {
                characters.push({
                  characterId: Number((character as Character).characterId),
                  name: (character as Character).name,
                  enabled: (character as Character).enabled,
                });
                characterId++;
              } else {
                break; // No more characters
              }
            } catch (err) {
              console.log(
                `No more characters found after index ${characterId}`
              );
              break;
            }
          }

          // Get any royalty information
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
            mintPrice: Object.values(rarityPrices)[0] || "0", // Default mint price
            maxSupply: 0, // ERC1155 doesn't typically have a max supply concept
            totalMinted: 0, // Will need to calculate from token balances
            royaltyFee,
            owner: owner as string,
            metadata: metadata as unknown as CollectionMetadata,
            mintingEnabled: true, // Assume enabled by default
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
  const { writeContract, data, isError, error } = useWriteContract();
  const { isLoading, isSuccess } = useTransaction({ hash: data });
  const publicClient = usePublicClient();
  const config = useConfig();
  const targetChainId = getActiveChain().id;

  // Log the active chain when the hook is initialized
  useEffect(() => {
    console.log("Active chain in useMintERC1155:", publicClient?.chain);
    console.log(
      "Target chain for minting:",
      getActiveChain().name,
      targetChainId
    );
  }, [publicClient, targetChainId]);

  const mintERC1155 = async (
    rarityType: KekTrumpsRarity,
    amount: number,
    price: string
  ) => {
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
    console.log("Mint rarity:", rarityType);
    console.log("Mint amount:", amount);
    console.log("Mint price:", price);

    try {
      // Call the mint function with price calculated for the number of tokens
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
    txHash: data,
  };
}

export function useERC1155CollectionTokens(collectionAddress: string) {
  const { address } = useAccount();
  const [tokens, setTokens] = useState<ERC1155Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [characterStats, setCharacterStats] = useState<{
    [characterId: number]: {
      [rarity: number]: {
        minted: number;
        maxSupply: number;
      };
    };
  }>({});

  const fetchAllTokens = useCallback(async () => {
    if (!collectionAddress || collectionAddress === "") {
      console.log("No collection address, skipping fetch");
      return;
    }

    console.log(`Fetching ERC1155 tokens for collection ${collectionAddress}`);
    setLoading(true);

    try {
      // Create public client
      const publicClient = createPublicClient({
        chain: getActiveChain(),
        transport: http(),
      });

      // First, get all available characters
      const characters: {
        characterId: number;
        name: string;
        enabled: boolean;
      }[] = [];

      let characterId = 0;

      // We'll try to fetch up to 100 characters (a reasonable upper limit)
      while (characterId < 100) {
        try {
          const character = await publicClient.readContract({
            address: collectionAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "characters",
            args: [characterId],
          });

          if (character && (character as Character).characterId !== undefined) {
            characters.push({
              characterId: Number((character as Character).characterId),
              name: (character as Character).name,
              enabled: (character as Character).enabled,
            });
            characterId++;
          } else {
            break; // No more characters
          }
        } catch (err) {
          console.log(`No more characters found after index ${characterId}`);
          break;
        }
      }

      console.log(`Found ${characters.length} characters`);

      // Get the character mint status for each character and rarity
      const characterStatsData: {
        [characterId: number]: {
          [rarity: number]: {
            minted: number;
            maxSupply: number;
          };
        };
      } = {};

      for (const character of characters) {
        characterStatsData[character.characterId] = {};

        for (let rarity = 0; rarity < 4; rarity++) {
          try {
            const mintStatus = await publicClient.readContract({
              address: collectionAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "getCharacterMintStatus",
              args: [character.characterId, rarity],
            });

            if (
              mintStatus &&
              Array.isArray(mintStatus) &&
              mintStatus.length >= 2
            ) {
              characterStatsData[character.characterId][rarity] = {
                minted: Number(mintStatus[0]),
                maxSupply: Number(mintStatus[1]),
              };
            }
          } catch (err) {
            console.error(
              `Failed to get mint status for character ${character.characterId}, rarity ${rarity}:`,
              err
            );
            // Set default values
            characterStatsData[character.characterId][rarity] = {
              minted: 0,
              maxSupply: 0,
            };
          }
        }
      }

      setCharacterStats(characterStatsData);

      // Now for each character and rarity combination, get the token ID and details
      const tokensData: ERC1155Item[] = [];

      for (const character of characters) {
        for (let rarity = 0; rarity < 4; rarity++) {
          try {
            // Get token ID for this character and rarity
            const tokenId = await publicClient.readContract({
              address: collectionAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "getTokenId",
              args: [character.characterId, rarity],
            });

            if (tokenId === undefined) continue;

            // Get the token URI
            const uri = await publicClient.readContract({
              address: collectionAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "uri",
              args: [tokenId],
            });

            // Get total supply (minted) for this token
            const mintStats = characterStatsData[character.characterId][rarity];
            const supply = mintStats ? mintStats.minted : 0;

            // Get the current user's balance if they're connected
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
                console.error(
                  `Failed to get balance for token ${tokenId}:`,
                  err
                );
              }
            }

            tokensData.push({
              tokenId: Number(tokenId),
              characterId: character.characterId,
              rarity,
              uri: uri as string,
              supply,
              balance,
              collection: collectionAddress,
              metadata: undefined, // Will fetch in batches
            });
          } catch (err) {
            console.error(
              `Failed to get token for character ${character.characterId}, rarity ${rarity}:`,
              err
            );
            // Continue to next token
          }
        }
      }

      console.log(`Found ${tokensData.length} tokens`);

      // Update state with basic token data
      setTokens(tokensData);
      setLoading(false);

      // Now fetch metadata in batches
      fetchMetadataInBatches(tokensData);
    } catch (err) {
      console.error("Error fetching ERC1155 tokens:", err);
      setError("Failed to load tokens. Please try again later.");
      setLoading(false);
    }
  }, [collectionAddress, address]);

  // Function to fetch metadata in batches
  const fetchMetadataInBatches = async (tokens: ERC1155Item[]) => {
    setMetadataLoading(true);

    // Process in batches of 10 to avoid overloading the API
    const BATCH_SIZE = 10;
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
      const validTokens = batchTokens.filter((token) => token.uri);
      const tokenURIs = validTokens.map((token) => token.uri);

      // Skip if no valid tokens in this batch
      if (tokenURIs.length === 0) {
        continue;
      }

      try {
        // Fetch metadata for all tokens in this batch at once
        const metadataMap = await fetchBatchMetadataFromIPFS(
          tokenURIs as string[]
        );

        // Create metadata results array from the batch response
        const metadataResults = validTokens
          .map((token) => {
            if (!token.uri) return null;
            const metadata = metadataMap[token.uri];
            return metadata ? { tokenId: token.tokenId, metadata } : null;
          })
          .filter(Boolean);

        // Update the tokens with the new metadata
        setTokens((prevTokens) => {
          const newTokens = [...prevTokens];

          // Update metadata
          metadataResults.forEach((result) => {
            if (!result) return;
            const index = newTokens.findIndex(
              (n) => n.tokenId === result.tokenId
            );
            if (index !== -1) {
              newTokens[index] = {
                ...newTokens[index],
                metadata: result.metadata,
              };
            }
          });

          // Sort tokens by character ID and rarity for consistent display
          return newTokens.sort((a, b) => {
            if (a.characterId !== b.characterId) {
              return (a.characterId || 0) - (b.characterId || 0);
            }
            return (a.rarity || 0) - (b.rarity || 0);
          });
        });
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error);
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setMetadataLoading(false);
    console.log("Completed fetching all metadata");
  };

  // Fetch tokens when the collection address changes
  useEffect(() => {
    if (collectionAddress) {
      fetchAllTokens();
    } else {
      setTokens([]);
      setLoading(false);
      setError(null);
    }
  }, [collectionAddress, fetchAllTokens]);

  return {
    tokens,
    loading,
    metadataLoading,
    error,
    characterStats,
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

      // Get token details from contract
      const tokenDetails = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "getTokenDetails",
        args: [tokenId],
      });

      if (
        !tokenDetails ||
        !Array.isArray(tokenDetails) ||
        tokenDetails.length < 3
      ) {
        throw new Error("Invalid token details returned");
      }

      const characterId = Number(tokenDetails[0]);
      const characterName = tokenDetails[1] as string;
      const rarity = Number(tokenDetails[2]);

      // Get token URI
      const uri = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "uri",
        args: [tokenId],
      });

      // Get mint stats for this token
      const mintStatus = await publicClient.readContract({
        address: collectionAddress as `0x${string}`,
        abi: KekTrumpsABI.abi,
        functionName: "getCharacterMintStatus",
        args: [characterId, rarity],
      });

      const supply =
        Array.isArray(mintStatus) && mintStatus.length > 0
          ? Number(mintStatus[0])
          : 0;

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

      // Check if token is listed in marketplace
      const listing = undefined;
      try {
        // For ERC1155, you'll need to adapt your marketplace to handle these tokens
        // This is a placeholder for future implementation
      } catch (err) {
        console.error(
          `Error checking listing status for token ${tokenId}:`,
          err
        );
      }

      setToken({
        tokenId,
        characterId,
        rarity,
        uri: uri as string,
        metadata,
        supply,
        balance,
        collection: collectionAddress,
        listing,
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
  }, [fetchToken]);

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
      let characterId = 0;

      // We'll try to fetch up to 100 characters (a reasonable upper limit)
      while (characterId < 100) {
        try {
          const character = await publicClient.readContract({
            address: collectionAddress as `0x${string}`,
            abi: KekTrumpsABI.abi,
            functionName: "characters",
            args: [characterId],
          });

          if (character && (character as Character).characterId !== undefined) {
            characters.push({
              characterId: Number((character as Character).characterId),
              name: (character as Character).name,
              enabled: (character as Character).enabled,
            });
            characterId++;
          } else {
            break; // No more characters
          }
        } catch (err) {
          console.log(`No more characters found after index ${characterId}`);
          break;
        }
      }

      // Get any royalty information
      let royaltyFee = 0;
      try {
        const royaltyInfo = await publicClient.readContract({
          address: collectionAddress as `0x${string}`,
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

      // Try to estimate total minted tokens across all characters and rarities
      let totalMinted = 0;
      for (const character of characters) {
        for (let rarity = 0; rarity < 4; rarity++) {
          try {
            const mintStatus = await publicClient.readContract({
              address: collectionAddress as `0x${string}`,
              abi: KekTrumpsABI.abi,
              functionName: "getCharacterMintStatus",
              args: [character.characterId, rarity],
            });

            if (
              mintStatus &&
              Array.isArray(mintStatus) &&
              mintStatus.length >= 1
            ) {
              totalMinted += Number(mintStatus[0]);
            }
          } catch (err) {
            // Ignore errors when calculating total, just continue
          }
        }
      }

      // Get paused status
      let mintingEnabled = true;
      try {
        const paused = await publicClient.readContract({
          address: collectionAddress as `0x${string}`,
          abi: KekTrumpsABI.abi,
          functionName: "paused",
        });

        mintingEnabled = !(paused as boolean);
      } catch (err) {
        console.error(`Failed to get paused status:`, err);
      }

      setCollection({
        address: collectionAddress,
        name: (name as string) || "Unnamed ERC1155 Collection",
        symbol: (symbol as string) || "ERC1155",
        contractURI: (contractURI as string) || "",
        mintPrice: Object.values(rarityPrices)[0] || "0", // Default mint price
        maxSupply: 0, // ERC1155 doesn't typically have a global max supply
        totalMinted,
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
    if (isERC1155Collection(collection)) {
      fetchCollection();
    }
  }, [collection, fetchCollection]);

  return { collection, loading, error, refresh: fetchCollection };
}
