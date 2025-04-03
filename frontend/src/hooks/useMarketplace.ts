// hooks/useMarketplace.ts
import { useState, useCallback } from "react";
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
        }: Collection=${collectionAddress}, TokenId=${tokenId}, Price=${price}`
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

      // We use the standard listItem function for all tokens
      // The contract only supports ERC721 currently, so we need to make sure
      // the approval is correct (setApprovalForAll for ERC1155)
      const tx = await marketplaceContract.listItem(
        collectionAddress,
        tokenId,
        priceInWei,
        process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN !== "true"
          ? {
              gasPrice: 9,
              gasLimit: 3000000,
              nonce: nonce,
            }
          : {}
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
    price: string,
    quantity: number = 1,
    isERC1155: boolean = false
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
      const txSettings =
        process.env.NEXT_PUBLIC_USE_LOCAL_CHAIN !== "true"
          ? {
              gasPrice: 9,
              gasLimit: 3000000,
              nonce: nonce, // Use the nonce from publicClient
            }
          : {};

      // Current marketplace contract only supports standard ERC721 buyItem
      const tx = await marketplaceContract.buyItem(nftContract, tokenId, {
        value: parseEther(price),
        ...txSettings,
      });

      setTxHash(tx.hash);

      // Wait for transaction to complete
      const receipt = await tx.wait();

      setIsSuccess(true);
      return true;
    } catch (err) {
      console.error("Error buying:", err);
      setError(err instanceof Error ? err : new Error("Failed to buy"));
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
