// hooks/useMarketplace.ts
import { useState, useCallback, useEffect } from "react";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useWriteContract,
  useTransaction,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { MARKETPLACE_ADDRESS } from "@/constants/addresses";
import MarketplaceABI from "@/contracts/BasedSeaMarketplace.json";
import {
  getMarketplaceContract,
  getNFTContractWithSigner,
  getERC1155ContractWithSigner,
} from "@/lib/contracts";
import { isERC1155Collection } from "@/utils/collectionTypeDetector";
// Import database functions
import {
  createListing,
  updateListingStatus,
  generateERC1155ListingId,
  getActiveListingsForToken,
  getListing,
  updateListingQuantityAndPrice,
  Listing,
} from "@/lib/db";

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
    price: string,
    quantity: number = 1,
    isERC1155: boolean = false
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
        `Listing ${
          isERC1155 ? "ERC1155" : "NFT"
        }: Collection=${collectionAddress}, TokenId=${tokenId}, Price=${price}, Quantity=${quantity}`
      );

      // 1. First step: Approve the marketplace
      try {
        console.log(`Requesting marketplace approval for token #${tokenId}...`);
        setApprovalStep(true);

        if (isERC1155) {
          // For ERC1155, we need to use setApprovalForAll
          const erc1155Contract = await getERC1155ContractWithSigner(
            collectionAddress
          );

          // Check if already approved
          const isApproved = await erc1155Contract.isApprovedForAll(
            userAddress,
            MARKETPLACE_ADDRESS
          );

          if (!isApproved) {
            // Request approval for marketplace to manage all tokens (required for ERC1155)
            const approvalTx = await erc1155Contract.setApprovalForAll(
              MARKETPLACE_ADDRESS,
              true
            );
            setApprovalTxHash(approvalTx.hash);

            console.log(
              `ERC1155 Approval transaction submitted: ${approvalTx.hash}`
            );
            console.log("Waiting for ERC1155 approval confirmation...");

            // Wait for approval transaction to complete
            const approvalReceipt = await approvalTx.wait();
            console.log(
              `ERC1155 Approval confirmed in block ${approvalReceipt.blockNumber}`
            );
          } else {
            console.log("Marketplace already approved for ERC1155 collection");
          }
        } else {
          // For ERC721, we approve a specific token
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
        }
      } catch (approvalError) {
        console.error("Approval failed:", approvalError);
        throw new Error("Failed to approve marketplace. Please try again.");
      }

      // 2. Second step: List the NFT on the marketplace
      console.log("Proceeding to list on marketplace...");
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

      let tx;
      const txSettings =
        process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN !== "true"
          ? {
              gasPrice: 9,
              gasLimit: 3000000,
              nonce: nonce,
            }
          : {};

      if (isERC1155) {
        // For ERC1155, use the new listERC1155Item function
        console.log(`Listing ERC1155 token with quantity ${quantity}`);
        tx = await marketplaceContract.listERC1155Item(
          collectionAddress,
          tokenId,
          quantity,
          priceInWei,
          txSettings
        );
      } else {
        // For ERC721, use the standard listItem function
        tx = await marketplaceContract.listItem(
          collectionAddress,
          tokenId,
          priceInWei,
          txSettings
        );
      }

      setTxHash(tx.hash);
      console.log(`Transaction submitted: ${tx.hash}`);

      // Wait for transaction to complete
      console.log("Waiting for transaction confirmation...");
      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Get the listing from the smart contract to ensure we have the latest data
      const onChainListing = await marketplaceContract.getListing(
        collectionAddress,
        isERC1155
          ? generateERC1155ListingId(tokenId.toString(), userAddress)
          : tokenId
      );

      // Create a listing record in our database with the on-chain data
      const listingData: Listing = {
        id: `${collectionAddress}_${tokenId}_${userAddress}`,
        nftContract: collectionAddress,
        tokenId: tokenId.toString(),
        seller: onChainListing.seller,
        price: onChainListing.price.toString(),
        quantity: onChainListing.quantity,
        isPrivate: onChainListing.isPrivate,
        allowedBuyer: onChainListing.allowedBuyer,
        status: "Active",
        listingId: isERC1155
          ? generateERC1155ListingId(tokenId.toString(), userAddress)
          : tokenId.toString(),
        isERC1155: isERC1155,
        timestamp: Date.now(),
      };

      const dbSuccess = await createListing(listingData);

      if (!dbSuccess) {
        console.warn(
          "Blockchain listing succeeded but database update failed. UI might be out of sync."
        );
      } else {
        console.log("Database updated successfully with listing information");
      }

      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Error listing for sale:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to list for sale")
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
  const { address: userAddress } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const buyNFT = useCallback(
    async (
      collectionAddress: string,
      tokenId: string,
      seller: string,
      price: string,
      quantity: number = 1,
      isERC1155: boolean = false
    ) => {
      if (!userAddress) {
        throw new Error("No wallet connected");
      }

      setIsLoading(true);
      setError(null);
      setTxHash(null);

      try {
        const marketplaceContract = await getMarketplaceContract();

        let listing;
        if (isERC1155) {
          // For ERC1155, first try to get from database since we need the combined listing ID
          listing = await getListing(collectionAddress, tokenId, seller);
          console.log("db listing", listing);
          if (!listing) {
            throw new Error("ERC1155 listing not found");
          }
        } else {
          // For ERC721, get directly from smart contract
          listing = await marketplaceContract.getListing(
            collectionAddress,
            tokenId
          );
          console.log("contract listing", listing);
          if (!listing || listing.status !== 1) {
            // 1 = Active in the ListingStatus enum
            throw new Error("ERC721 listing not found or not active");
          }
          // Verify the seller matches
          if (listing.seller.toLowerCase() !== seller.toLowerCase()) {
            throw new Error("Seller mismatch");
          }
        }

        let tx;
        if (isERC1155) {
          // Listing price is PER token and is in wei already
          const buyPrice = BigInt(listing.price) * BigInt(quantity);

          tx = await marketplaceContract.buyERC1155Item(
            collectionAddress,
            tokenId,
            seller,
            quantity,
            { value: buyPrice }
          );
        } else {
          tx = await marketplaceContract.buyItem(
            collectionAddress,
            tokenId,
            seller,
            { value: BigInt(listing.price) }
          );
        }

        setTxHash(tx.hash);
        console.log(`Transaction submitted: ${tx.hash}`);

        // Wait for transaction to complete
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

        // Update our database to stay in sync
        // For ERC1155, check if it was a partial purchase
        if (isERC1155) {
          const remainingQuantity = listing.quantity - quantity;
          if (remainingQuantity > 0) {
            // Partial purchase - update the listing with remaining quantity
            await updateListingQuantityAndPrice(
              collectionAddress,
              tokenId,
              seller,
              remainingQuantity,
              listing.price // Keep the same price per token
            );
          } else {
            // Complete purchase - mark listing as sold
            await updateListingStatus(
              collectionAddress,
              tokenId,
              seller,
              "Sold"
            );
          }
        } else {
          // For ERC721, always mark as sold
          await updateListingStatus(collectionAddress, tokenId, seller, "Sold");
        }

        setIsSuccess(true);
      } catch (err) {
        console.error("Error buying NFT:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [userAddress]
  );

  return {
    buyNFT,
    isLoading,
    isSuccess,
    error,
    txHash,
  };
}

// Hook for canceling ERC1155 listings
export function useCancelERC1155Listing() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const cancelERC1155Listing = async (nftContract: string, tokenId: number) => {
    if (!userAddress || !publicClient) throw new Error("Wallet not connected");

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);
    setTxHash(null);

    try {
      // Get the next nonce
      const nonce = await publicClient.getTransactionCount({
        address: userAddress,
        blockTag: "pending",
      });

      // Get marketplace contract
      const marketplaceContract = await getMarketplaceContract();
      const txSettings =
        process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN !== "true"
          ? {
              gasPrice: 9,
              gasLimit: 3000000,
              nonce: nonce,
            }
          : {};

      // Use the special cancelERC1155Listing function
      const tx = await marketplaceContract.cancelERC1155Listing(
        nftContract,
        tokenId,
        txSettings
      );

      setTxHash(tx.hash);
      console.log(`Cancel transaction submitted: ${tx.hash}`);

      // Wait for transaction to complete
      const receipt = await tx.wait();
      console.log(`Cancellation confirmed in block ${receipt.blockNumber}`);

      // Update database with the new status
      console.log("Updating database with cancellation information...");
      const dbSuccess = await updateListingStatus(
        nftContract,
        tokenId.toString(),
        userAddress,
        "Canceled"
      );

      if (!dbSuccess) {
        console.warn(
          "Blockchain cancellation succeeded but database update failed. UI might be out of sync."
        );
      } else {
        console.log(
          "Database updated successfully with cancellation information"
        );
      }

      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Error canceling ERC1155 listing:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to cancel listing")
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    cancelERC1155Listing,
    isLoading,
    isSuccess,
    error,
    txHash,
  };
}

// Hook for creating and executing offers with signatures
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
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);

  // Clean up database entry if transaction fails
  useEffect(() => {
    if (isError && pendingListingId && address) {
      // Extract tokenId and nftContract from pendingListingId
      const [nftContract, tokenId] = pendingListingId.split("_");
      if (nftContract && tokenId) {
        // Update the listing status in the database to "Canceled"
        updateListingStatus(nftContract, tokenId, address, "Canceled")
          .then(() => {
            console.log("Cleaned up failed listing from database");
          })
          .catch((err) => {
            console.error("Error cleaning up failed listing:", err);
          })
          .finally(() => {
            setPendingListingId(null);
          });
      }
    }
  }, [isError, pendingListingId, address]);

  // Add effect to sync database when transaction succeeds
  useEffect(() => {
    const syncDatabase = async () => {
      if (isSuccess && pendingListingId && address) {
        try {
          // Extract tokenId and nftContract from pendingListingId
          const [nftContract, tokenId] = pendingListingId.split("_");
          if (!nftContract || !tokenId) return;

          // Get the listing from the smart contract to ensure we have the latest data
          const marketplaceContract = await getMarketplaceContract();
          const onChainListing = await marketplaceContract.getListing(
            nftContract,
            tokenId
          );

          // Update the database with the confirmed on-chain data
          const listingData: Listing = {
            id: pendingListingId,
            nftContract: nftContract,
            tokenId: tokenId,
            seller: onChainListing.seller,
            price: onChainListing.price.toString(),
            quantity: onChainListing.quantity,
            isPrivate: onChainListing.isPrivate,
            allowedBuyer: onChainListing.allowedBuyer,
            status: "Active",
            listingId: tokenId,
            isERC1155: onChainListing.quantity > 1,
            timestamp: Date.now(),
          };

          await createListing(listingData);
          console.log("Database synchronized with on-chain listing");
        } catch (err) {
          console.error("Error syncing database with on-chain listing:", err);
        } finally {
          setPendingListingId(null);
        }
      }
    };

    syncDatabase();
  }, [isSuccess, pendingListingId, address]);

  const createPrivateListing = async (
    nftContract: string,
    tokenId: number,
    price: string,
    allowedBuyer: string,
    quantity: number = 1,
    isERC1155: boolean = false
  ) => {
    if (!address) throw new Error("Wallet not connected");

    const priceInWei = parseEther(price);

    // Create a unique ID for tracking this listing
    const uniqueListingId = `${nftContract}_${tokenId}_${address}`;
    setPendingListingId(uniqueListingId);

    writeContract({
      address: MARKETPLACE_ADDRESS as `0x${string}`,
      abi: MarketplaceABI.abi,
      functionName: "createPrivateListing",
      args: [
        nftContract as `0x${string}`,
        BigInt(tokenId),
        priceInWei,
        allowedBuyer as `0x${string}`,
        BigInt(quantity),
      ],
    });

    return { txHash: data };
  };

  return {
    createPrivateListing,
    isLoading,
    isSuccess,
    isError,
    error,
    txHash: data,
    pendingListingId,
  };
}
