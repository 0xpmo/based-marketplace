import { sql } from "@vercel/postgres";
import { ethers } from "ethers";
import { Listing } from "@/types/listings";

// Create a new listing
export async function createListing(listing: Listing): Promise<boolean> {
  try {
    await sql`
      INSERT INTO listings (
        id, nft_contract, token_id, seller, price, 
        quantity, is_private, allowed_buyer, status, 
        listing_id, is_erc1155, timestamp
      ) VALUES (
        ${listing.id}, 
        ${listing.nftContract}, 
        ${listing.tokenId}, 
        ${listing.seller}, 
        ${listing.price}, 
        ${listing.quantity}, 
        ${listing.isPrivate}, 
        ${listing.allowedBuyer}, 
        ${listing.status}, 
        ${listing.listingId}, 
        ${listing.isERC1155}, 
        ${listing.timestamp}
      )
      ON CONFLICT (id) DO UPDATE SET
        price = ${listing.price},
        quantity = ${listing.quantity},
        is_private = ${listing.isPrivate},
        allowed_buyer = ${listing.allowedBuyer},
        status = ${listing.status},
        timestamp = ${listing.timestamp}
    `;
    return true;
  } catch (error) {
    console.error("Error creating listing:", error);
    return false;
  }
}

// Get active listings for a collection
export async function getActiveListingsForCollection(
  nftContract: string
): Promise<Listing[]> {
  try {
    const result = await sql<Listing>`
      SELECT 
        id, 
        nft_contract as "nftContract", 
        token_id as "tokenId", 
        seller, 
        price, 
        quantity, 
        is_private as "isPrivate", 
        allowed_buyer as "allowedBuyer", 
        status, 
        listing_id as "listingId", 
        is_erc1155 as "isERC1155", 
        timestamp
      FROM listings 
      WHERE nft_contract = ${nftContract} 
      AND status = 'Active'
    `;

    return result.rows;
  } catch (error) {
    console.error("Error getting active listings for collection:", error);
    return [];
  }
}

// Get active listings for a token
export async function getActiveListingsForToken(
  nftContract: string,
  tokenId: string
): Promise<Listing[]> {
  try {
    const result = await sql<Listing>`
      SELECT 
        id, 
        nft_contract as "nftContract", 
        token_id as "tokenId", 
        seller, 
        price, 
        quantity, 
        is_private as "isPrivate", 
        allowed_buyer as "allowedBuyer", 
        status, 
        listing_id as "listingId", 
        is_erc1155 as "isERC1155", 
        timestamp
      FROM listings 
      WHERE nft_contract = ${nftContract} 
      AND token_id = ${tokenId} 
      AND status = 'Active'
    `;

    return result.rows;
  } catch (error) {
    console.error("Error getting active listings for token:", error);
    return [];
  }
}

// Get active listings by seller
export async function getActiveListingsBySeller(
  seller: string
): Promise<Listing[]> {
  try {
    const result = await sql<Listing>`
      SELECT 
        id, 
        nft_contract as "nftContract", 
        token_id as "tokenId", 
        seller, 
        price, 
        quantity, 
        is_private as "isPrivate", 
        allowed_buyer as "allowedBuyer", 
        status, 
        listing_id as "listingId", 
        is_erc1155 as "isERC1155", 
        timestamp
      FROM listings 
      WHERE seller = ${seller} 
      AND status = 'Active'
    `;

    return result.rows;
  } catch (error) {
    console.error("Error getting active listings by seller:", error);
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
    const id = `${nftContract}_${tokenId}_${seller}`;
    const result = await sql<Listing>`
      SELECT 
        id, 
        nft_contract as "nftContract", 
        token_id as "tokenId", 
        seller, 
        price, 
        quantity, 
        is_private as "isPrivate", 
        allowed_buyer as "allowedBuyer", 
        status, 
        listing_id as "listingId", 
        is_erc1155 as "isERC1155", 
        timestamp
      FROM listings 
      WHERE id = ${id}
    `;

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error("Error getting listing:", error);
    return null;
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
    const id = `${nftContract}_${tokenId}_${seller}`;
    const result = await sql`
      UPDATE listings 
      SET status = ${status}, 
          timestamp = ${Date.now()}
      WHERE id = ${id}
    `;

    return true;
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
    const id = `${nftContract}_${tokenId}_${seller}`;
    const result = await sql`
      UPDATE listings 
      SET quantity = ${newQuantity},
          price = ${newPrice},
          timestamp = ${Date.now()}
      WHERE id = ${id}
    `;

    return true;
  } catch (error) {
    console.error("Error updating listing quantity and price:", error);
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
