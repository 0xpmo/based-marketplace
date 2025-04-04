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
// Import database functions
import {
  createListing,
  updateListingStatus,
  generateERC1155ListingId,
  getListing,
  updateListingQuantityAndPrice,
  Listing,
} from "@/lib/db";

// Add type for on-chain listing structure
type OnChainListing = [
  seller: string,
  nftContract: string,
  tokenId: bigint,
  price: bigint,
  isPrivate: boolean,
  allowedBuyer: string,
  status: bigint,
  quantity: bigint
];

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
  const { data: walletClient } = useWalletClient();

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

      // Verify ownership first
      try {
        if (isERC1155) {
          const nft = await getERC1155ContractWithSigner(collectionAddress);
          const balance = await nft.balanceOf(userAddress, tokenId);
          if (balance < quantity) {
            throw new Error("Insufficient token balance");
          }
        } else {
          const nft = await getNFTContractWithSigner(collectionAddress);
          const owner = await nft.ownerOf(tokenId);
          if (owner.toLowerCase() !== userAddress.toLowerCase()) {
            throw new Error("You don't own this NFT");
          }
        }
      } catch (err) {
        throw new Error("Failed to verify NFT ownership");
      }

      // Check if there's an existing listing in the database
      const existingListing = await getListing(
        collectionAddress,
        tokenId.toString(),
        userAddress
      );
      if (existingListing && existingListing.status === "Active") {
        // Check if it exists on-chain
        const listingId = isERC1155
          ? generateERC1155ListingId(tokenId.toString(), userAddress)
          : tokenId;

        try {
          const marketplaceContract = await getMarketplaceContract();
          const onChainListing = (await marketplaceContract.getListing(
            collectionAddress,
            listingId
          )) as OnChainListing;
          if (onChainListing && onChainListing[6] === BigInt(1)) {
            // 1 = Active
            throw new Error("NFT is already listed");
          } else {
            // If listing exists in DB but not on chain, clean it up
            await updateListingStatus(
              collectionAddress,
              tokenId.toString(),
              userAddress,
              "Canceled"
            );
          }
        } catch (err) {
          // If we can't get the on-chain listing, clean up the database
          await updateListingStatus(
            collectionAddress,
            tokenId.toString(),
            userAddress,
            "Canceled"
          );
        }
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
          const erc1155Contract = await getERC1155ContractWithSigner(
            collectionAddress
          );
          const isApproved = await erc1155Contract.isApprovedForAll(
            userAddress,
            MARKETPLACE_ADDRESS
          );

          if (!isApproved) {
            const approvalTx = await erc1155Contract.setApprovalForAll(
              MARKETPLACE_ADDRESS,
              true
            );
            setApprovalTxHash(approvalTx.hash);
            console.log(
              `ERC1155 Approval transaction submitted: ${approvalTx.hash}`
            );
            const approvalReceipt = await approvalTx.wait();
            console.log(
              `ERC1155 Approval confirmed in block ${approvalReceipt.blockNumber}`
            );
          }
        } else {
          // For ERC721 tokens
          const nftContract = await getNFTContractWithSigner(collectionAddress);
          const isApproved = await nftContract.isApprovedForAll(
            userAddress,
            MARKETPLACE_ADDRESS
          );

          if (!isApproved) {
            const approvalTx = await nftContract.setApprovalForAll(
              MARKETPLACE_ADDRESS,
              true
            );
            setApprovalTxHash(approvalTx.hash);
            console.log(`Approval transaction submitted: ${approvalTx.hash}`);
            const approvalReceipt = await approvalTx.wait();
            console.log(
              `Approval confirmed in block ${approvalReceipt.blockNumber}`
            );
          }
        }
      } catch (approvalError) {
        console.error("Approval failed:", approvalError);
        throw new Error("Failed to approve marketplace. Please try again.");
      }

      // 2. Second step: List the NFT on the marketplace
      console.log("Proceeding to list on marketplace...");
      setApprovalStep(false);

      const priceInWei = parseEther(price);
      const marketplaceContract = await getMarketplaceContract();
      console.log("Marketplace contract obtained, executing transaction...");

      const nonce = await publicClient.getTransactionCount({
        address: userAddress,
        blockTag: "pending",
      });

      const txSettings =
        process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN !== "true"
          ? { gasPrice: 9, gasLimit: 3000000, nonce }
          : {};

      let tx;
      if (isERC1155) {
        tx = await marketplaceContract.listERC1155Item(
          collectionAddress,
          tokenId,
          quantity,
          priceInWei,
          txSettings
        );
      } else {
        tx = await marketplaceContract.listItem(
          collectionAddress,
          tokenId,
          priceInWei,
          txSettings
        );
      }

      setTxHash(tx.hash);
      console.log(`Transaction submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Get the listing from the smart contract to ensure we have the latest data
      const onChainListing = (await marketplaceContract.getListing(
        collectionAddress,
        isERC1155
          ? generateERC1155ListingId(tokenId.toString(), userAddress)
          : tokenId
      )) as OnChainListing;

      console.log("onChainListing", onChainListing);
      console.log("seller", onChainListing[0]);
      console.log("nftContract", onChainListing[1]);
      console.log("tokenId", onChainListing[2]);
      console.log("price", onChainListing[3]);
      console.log("isPrivate", onChainListing[4]);
      console.log("allowedBuyer", onChainListing[5]);
      console.log("status", onChainListing[6]);
      console.log("quantity", onChainListing[7]);

      // Create a listing record in our database with the on-chain data
      const listingData: Listing = {
        id: `${collectionAddress}_${tokenId}_${userAddress}`,
        nftContract: collectionAddress,
        tokenId: tokenId.toString(),
        seller: onChainListing[0],
        price: onChainListing[3].toString(),
        quantity: Number(onChainListing[7]), // Convert bigint to number
        isPrivate: onChainListing[4],
        allowedBuyer: onChainListing[5],
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
  const publicClient = usePublicClient();

  const buyNFT = useCallback(
    async (
      collectionAddress: string,
      tokenId: string,
      seller: string,
      price: string, // price is in wei
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
        if (!userAddress || !publicClient) {
          throw new Error("Wallet not connected");
        }
        const marketplaceContract = await getMarketplaceContract();

        // Get the listing from both database and smart contract
        const dbListing = await getListing(collectionAddress, tokenId, seller);
        if (!dbListing) {
          throw new Error("Listing not found in database");
        }

        // For ERC1155, we need to use the special listing ID
        const listingId = isERC1155
          ? generateERC1155ListingId(tokenId, seller)
          : tokenId;

        // Get on-chain listing
        let onChainListing;
        try {
          onChainListing = (await marketplaceContract.getListing(
            collectionAddress,
            listingId
          )) as OnChainListing;
          console.log("onChainListing", onChainListing);
        } catch (err) {
          console.error("Error fetching on-chain listing:", err);
          // If we can't get the on-chain listing, clean up the database
          await updateListingStatus(
            collectionAddress,
            tokenId,
            seller,
            "Canceled"
          );
          throw new Error("Listing not found on blockchain");
        }

        // Verify listing is still active and valid
        if (!onChainListing || onChainListing[6] !== BigInt(1)) {
          // 1 = Active
          // Clean up database if blockchain shows listing is inactive
          await updateListingStatus(
            collectionAddress,
            tokenId,
            seller,
            "Canceled"
          );
          throw new Error("Listing is no longer active on blockchain");
        }

        // Verify ownership
        try {
          if (isERC1155) {
            const nft = await getERC1155ContractWithSigner(collectionAddress);
            const balance = await nft.balanceOf(seller, tokenId);
            if (balance < quantity) {
              // Clean up database if seller doesn't have enough tokens
              await updateListingStatus(
                collectionAddress,
                tokenId,
                seller,
                "Canceled"
              );
              throw new Error("Seller no longer owns enough tokens");
            }
          } else {
            const nft = await getNFTContractWithSigner(collectionAddress);
            const owner = await nft.ownerOf(tokenId);
            if (owner.toLowerCase() !== seller.toLowerCase()) {
              // Clean up database if ownership has changed
              await updateListingStatus(
                collectionAddress,
                tokenId,
                seller,
                "Canceled"
              );
              throw new Error("Seller no longer owns this NFT");
            }
          }
        } catch (err) {
          // Clean up database if ownership check fails
          await updateListingStatus(
            collectionAddress,
            tokenId,
            seller,
            "Canceled"
          );
          throw new Error("Failed to verify NFT ownership");
        }

        const nonce = await publicClient.getTransactionCount({
          address: userAddress,
          blockTag: "pending",
        });

        const txSettings =
          process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN !== "true"
            ? { gasPrice: 9, gasLimit: 3000000, nonce }
            : {};

        let tx;
        if (isERC1155) {
          // Listing price is PER token and is in wei already

          // const buyPrice = onChainListing[3] * BigInt(quantity);
          const buyPrice = BigInt(price) * BigInt(quantity);
          tx = await marketplaceContract.buyERC1155Item(
            collectionAddress,
            tokenId,
            seller,
            quantity,
            { value: buyPrice, ...txSettings }
          );
        } else {
          tx = await marketplaceContract.buyItem(collectionAddress, tokenId, {
            value: BigInt(price),
            ...txSettings,
          });
        }

        setTxHash(tx.hash);
        console.log(`Transaction submitted: ${tx.hash}`);

        // Wait for transaction to complete
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

        // Update database based on purchase type
        if (isERC1155 && quantity < dbListing.quantity) {
          // Partial purchase - update remaining quantity
          const remainingQuantity = dbListing.quantity - quantity;
          await updateListingQuantityAndPrice(
            collectionAddress,
            tokenId,
            seller,
            remainingQuantity,
            dbListing.price
          );
        } else {
          // Complete purchase - mark as sold
          await updateListingStatus(collectionAddress, tokenId, seller, "Sold");
        }

        setIsSuccess(true);
      } catch (err) {
        console.error("Error buying NFT:", err);
        // If the error indicates the NFT is no longer available, clean up the database
        if (
          err instanceof Error &&
          (err.message.includes("no longer owns") ||
            err.message.includes("not found") ||
            err.message.includes("not active"))
        ) {
          await updateListingStatus(
            collectionAddress,
            tokenId,
            seller,
            "Canceled"
          );
        }
        setError(err instanceof Error ? err : new Error("Failed to buy NFT"));
        throw err;
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
          const onChainListing = (await marketplaceContract.getListing(
            nftContract,
            tokenId
          )) as OnChainListing;

          // Update the database with the confirmed on-chain data
          const listingData: Listing = {
            id: pendingListingId,
            nftContract: nftContract,
            tokenId: tokenId,
            seller: onChainListing[0],
            price: onChainListing[3].toString(),
            quantity: Number(onChainListing[7]), // Convert bigint to number
            isPrivate: onChainListing[4],
            allowedBuyer: onChainListing[5],
            status: "Active",
            listingId: tokenId,
            isERC1155: Number(onChainListing[7]) > 1,
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

export function useCancelListing() {
  const { address: userAddress } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const publicClient = usePublicClient();

  const cancelListing = useCallback(
    async (
      collectionAddress: string,
      tokenId: string,
      isERC1155: boolean = false
    ) => {
      if (!userAddress) {
        throw new Error("No wallet connected");
      }

      console.log("doin shit");

      setIsLoading(true);
      setError(null);
      setTxHash(null);

      try {
        if (!userAddress || !publicClient) {
          throw new Error("Wallet not connected");
        }

        const marketplaceContract = await getMarketplaceContract();

        // Get the listing from database
        const dbListing = await getListing(
          collectionAddress,
          tokenId,
          userAddress
        );
        console.log("got listing", dbListing);
        if (!dbListing) {
          throw new Error("Listing not found in database");
        }

        // For ERC1155, we need to use the special listing ID
        const listingId = isERC1155
          ? generateERC1155ListingId(tokenId, userAddress)
          : tokenId;

        console.log("listing id", listingId);

        // Get on-chain listing
        let onChainListing;
        try {
          onChainListing = (await marketplaceContract.getListing(
            collectionAddress,
            listingId
          )) as OnChainListing;
          console.log("on chain listing", onChainListing);
        } catch (err) {
          console.error("Error fetching on-chain listing:", err);
          // If we can't get the on-chain listing, clean up the database
          await updateListingStatus(
            collectionAddress,
            tokenId,
            userAddress,
            "Canceled"
          );
          throw new Error("Listing not found on blockchain");
        }

        // Verify listing is still active
        if (!onChainListing || onChainListing[6] !== BigInt(1)) {
          // 1 = Active
          // Clean up database if blockchain shows listing is inactive
          await updateListingStatus(
            collectionAddress,
            tokenId,
            userAddress,
            "Canceled"
          );
          throw new Error("Listing is no longer active on blockchain");
        }

        // Verify ownership
        try {
          if (isERC1155) {
            const nft = await getERC1155ContractWithSigner(collectionAddress);
            const balance = await nft.balanceOf(userAddress, tokenId);
            if (balance < dbListing.quantity) {
              // Clean up database if seller doesn't have enough tokens
              await updateListingStatus(
                collectionAddress,
                tokenId,
                userAddress,
                "Canceled"
              );
              throw new Error("You no longer own enough tokens");
            }
          } else {
            const nft = await getNFTContractWithSigner(collectionAddress);
            const owner = await nft.ownerOf(tokenId);
            if (owner.toLowerCase() !== userAddress.toLowerCase()) {
              // Clean up database if ownership has changed
              await updateListingStatus(
                collectionAddress,
                tokenId,
                userAddress,
                "Canceled"
              );
              throw new Error("You no longer own this NFT");
            }
          }
        } catch (err) {
          // Clean up database if ownership check fails
          await updateListingStatus(
            collectionAddress,
            tokenId,
            userAddress,
            "Canceled"
          );
          throw new Error("Failed to verify NFT ownership");
        }

        const nonce = await publicClient.getTransactionCount({
          address: userAddress,
          blockTag: "pending",
        });

        const txSettings =
          process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN !== "true"
            ? { gasPrice: 9, gasLimit: 3000000, nonce }
            : {};

        try {
          // Execute the cancellation
          let tx;
          if (isERC1155) {
            tx = await marketplaceContract.cancelERC1155Listing(
              collectionAddress,
              tokenId,
              txSettings
            );
          } else {
            console.log("we made it here wzoo");

            tx = await marketplaceContract.cancelListing(
              collectionAddress,
              tokenId,
              txSettings
            );
          }

          setTxHash(tx.hash);
          console.log(`Cancel transaction submitted: ${tx.hash}`);

          // Wait for transaction to complete
          const receipt = await tx.wait();
          console.log(`Cancellation confirmed in block ${receipt.blockNumber}`);

          // Update database after successful blockchain transaction
          await updateListingStatus(
            collectionAddress,
            tokenId,
            userAddress,
            "Canceled"
          );
        } catch (error) {
          console.error("Error during cancellation:", error);

          const ethersError = error as { message: string };

          // Check if the error indicates the listing doesn't exist
          if (
            ethersError.message.includes("listing not found") ||
            ethersError.message.includes("listing not active") ||
            ethersError.message.includes("invalid listing") ||
            ethersError.message.includes("execution reverted")
          ) {
            // If listing doesn't exist on-chain, still update the database
            console.log(
              "Listing not found on-chain, updating database status..."
            );
            await updateListingStatus(
              collectionAddress,
              tokenId,
              userAddress,
              "Canceled"
            );
          } else {
            // Re-throw other errors
            throw error;
          }
        }
        setIsSuccess(true);
      } catch (err) {
        console.error("Error canceling listing:", err);
        // If the error indicates the listing is no longer valid, clean up the database
        if (
          err instanceof Error &&
          (err.message.includes("no longer own") ||
            err.message.includes("not found") ||
            err.message.includes("not active"))
        ) {
          await updateListingStatus(
            collectionAddress,
            tokenId,
            userAddress,
            "Canceled"
          );
        }
        setError(
          err instanceof Error ? err : new Error("Failed to cancel listing")
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [userAddress]
  );

  return {
    cancelListing,
    isLoading,
    isSuccess,
    error,
    txHash,
  };
}
