"use client";

import { Listing } from "@/types/listings";
import { ethers } from "ethers";

// Get all active listings for a collection
export async function getActiveListingsForCollection(
  nftContract: string
): Promise<Listing[]> {
  try {
    const response = await fetch(
      `/api/listings/collection?address=${encodeURIComponent(nftContract)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.listings || [];
  } catch (error) {
    console.error("Error getting collection listings:", error);
    return [];
  }
}

// Get all active listings for a token
export async function getActiveListingsForToken(
  nftContract: string,
  tokenId: string
): Promise<Listing[]> {
  try {
    const response = await fetch(
      `/api/listings/token?address=${encodeURIComponent(
        nftContract
      )}&tokenId=${encodeURIComponent(tokenId)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.listings || [];
  } catch (error) {
    console.error("Error getting token listings:", error);
    return [];
  }
}

// Get all active listings by a seller
export async function getActiveListingsBySeller(
  seller: string
): Promise<Listing[]> {
  try {
    const response = await fetch(
      `/api/listings/seller?address=${encodeURIComponent(seller)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.listings || [];
  } catch (error) {
    console.error("Error getting seller listings:", error);
    return [];
  }
}

// Get a specific listing
export async function getListing(
  nftContract: string,
  tokenId: string,
  seller: string
): Promise<Listing | null> {
  try {
    const response = await fetch(
      `/api/listings/single?address=${encodeURIComponent(
        nftContract
      )}&tokenId=${encodeURIComponent(tokenId)}&seller=${encodeURIComponent(
        seller
      )}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.listing;
  } catch (error) {
    console.error("Error getting listing:", error);
    return null;
  }
}

// Create a new listing
export async function createListing(listing: Listing): Promise<boolean> {
  try {
    const response = await fetch("/api/listings/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(listing),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error creating listing:", error);
    return false;
  }
}

// Update a listing's status
export async function updateListingStatus(
  nftContract: string,
  tokenId: string,
  seller: string,
  status: "Active" | "Sold" | "Canceled"
): Promise<boolean> {
  try {
    const response = await fetch("/api/listings/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nftContract, tokenId, seller, status }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error updating listing status:", error);
    return false;
  }
}

// Update a listing's quantity and price
export async function updateListingQuantityAndPrice(
  nftContract: string,
  tokenId: string,
  seller: string,
  newQuantity: number,
  newPrice: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/listings/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: nftContract,
        tokenId,
        seller,
        newQuantity,
        newPrice,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error updating listing:", error);
    return false;
  }
}

// Helper function for ERC1155 listing ID generation
export function generateERC1155ListingId(
  tokenId: string,
  seller: string
): string {
  const abiCoder = new ethers.AbiCoder();
  const encodedData = abiCoder.encode(
    ["uint256", "address"],
    [tokenId, seller]
  );
  const hash = ethers.keccak256(encodedData);
  return ethers.toBigInt(hash).toString();
}
