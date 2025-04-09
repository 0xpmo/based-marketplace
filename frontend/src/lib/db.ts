// frontend/src/lib/db.ts
import { formatEther, parseEther } from "viem";

// This is a client-side interface file - database operations will be performed through API routes

export type DBListing = {
  id: number;
  seller: string;
  nft_contract: string;
  token_id: bigint;
  price: string;
  price_wei: string;
  is_private: boolean;
  allowed_buyer: string | null;
  status: number;
  transaction_hash: string | null;
  block_number: bigint | null;
  created_at: Date;
  updated_at: Date;
};

// Create a new listing via API
export async function createListing(
  seller: string,
  nftContract: string,
  tokenId: number,
  price: string,
  isPrivate: boolean = false,
  allowedBuyer: string | null = null,
  txHash: string | null = null,
  blockNumber: bigint | null = null
): Promise<DBListing> {
  const response = await fetch("/api/listings/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      seller,
      nftContract,
      tokenId,
      price,
      priceWei: parseEther(price).toString(),
      isPrivate,
      allowedBuyer,
      txHash,
      blockNumber: blockNumber ? blockNumber.toString() : null,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create listing: ${error}`);
  }

  return response.json();
}

// Update a listing status via API
export async function updateListingStatus(
  nftContract: string,
  tokenId: number,
  status: number,
  txHash: string | null = null,
  blockNumber: bigint | null = null
): Promise<DBListing | null> {
  console.log("updating listing status in db", nftContract, tokenId, status);
  const response = await fetch("/api/listings/update-status", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nftContract,
      tokenId,
      status,
      txHash,
      blockNumber: blockNumber ? blockNumber.toString() : null,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update listing status: ${error}`);
  }

  return response.json();
}

// Get listings for a collection via API
export async function getCollectionListings(
  nftContract: string,
  status: number = 1,
  page: number = 0,
  pageSize: number = 10
): Promise<{ listings: DBListing[]; total: number }> {
  const params = new URLSearchParams({
    nftContract,
    status: status.toString(),
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  const response = await fetch(`/api/listings/collection?${params.toString()}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch collection listings: ${error}`);
  }

  return response.json();
}

// Get listings by seller via API
export async function getSellerListings(
  seller: string,
  status: number = 1
): Promise<DBListing[]> {
  const params = new URLSearchParams({
    seller,
    status: status.toString(),
  });

  const response = await fetch(`/api/listings/seller?${params.toString()}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch seller listings: ${error}`);
  }

  return response.json();
}

// Get a single listing via API
export async function getListing(
  nftContract: string,
  tokenId: number
): Promise<DBListing | null> {
  const params = new URLSearchParams({
    nftContract,
    tokenId: tokenId.toString(),
  });

  const response = await fetch(`/api/listings/single?${params.toString()}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null; // Not found, return null
    }
    const error = await response.text();
    throw new Error(`Failed to fetch listing: ${error}`);
  }

  return response.json();
}

// Clear a listing from the database (for fixing inconsistencies)
export async function clearListing(
  nftContract: string,
  tokenId?: number
): Promise<{ success: boolean; deletedCount: number }> {
  const params = new URLSearchParams({ nftContract });

  if (tokenId !== undefined) {
    params.append("tokenId", tokenId.toString());
  }

  const response = await fetch(`/api/listings/clear?${params.toString()}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to clear listing: ${error}`);
  }

  return response.json();
}
