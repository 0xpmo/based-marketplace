import { Pool } from "pg";
import { DBListing } from "./db";

// This file is only imported in server contexts (API routes)

// Create connection pool - only initialized server-side
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Create a new listing
export async function createListing(
  seller: string,
  nftContract: string,
  tokenId: number,
  price: string,
  priceWei: string,
  isPrivate: boolean = false,
  allowedBuyer: string | null = null,
  txHash: string | null = null,
  blockNumber: string | null = null
): Promise<DBListing> {
  const query = `
    INSERT INTO listings 
    (seller, nft_contract, token_id, price, price_wei, is_private, allowed_buyer, transaction_hash, block_number) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`;

  const values = [
    seller,
    nftContract,
    tokenId,
    price,
    priceWei,
    isPrivate,
    allowedBuyer,
    txHash,
    blockNumber,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Update a listing status
export async function updateListingStatus(
  nftContract: string,
  tokenId: number,
  status: number,
  txHash: string | null = null,
  blockNumber: string | null = null
): Promise<DBListing | null> {
  console.log(
    `Updating listing status: Contract=${nftContract}, TokenId=${tokenId}, NewStatus=${status}`
  );

  // First check if the listing exists
  const checkQuery = `
    SELECT * FROM listings
    WHERE nft_contract = $1 AND token_id = $2`;

  const checkResult = await pool.query(checkQuery, [nftContract, tokenId]);

  if (checkResult.rows.length === 0) {
    console.warn(`No listing found for ${nftContract} token #${tokenId}`);
    return null;
  }

  const existingListing = checkResult.rows[0];
  console.log(
    `Found existing listing with status ${existingListing.status}, updating to ${status}`
  );

  // Now update the listing status - don't restrict by current status
  const query = `
    UPDATE listings
    SET status = $1, transaction_hash = $2, block_number = $3, updated_at = CURRENT_TIMESTAMP
    WHERE nft_contract = $4 AND token_id = $5
    RETURNING *`;

  const values = [status, txHash, blockNumber, nftContract, tokenId];

  const result = await pool.query(query, values);

  if (result.rows.length > 0) {
    console.log(`Successfully updated listing status to ${status}`);
    return result.rows[0];
  } else {
    console.error(`Failed to update listing status, no rows affected`);
    return null;
  }
}

// Get listings for a collection
export async function getCollectionListings(
  nftContract: string,
  status: number = 1,
  page: number = 0,
  pageSize: number = 10
): Promise<{ listings: DBListing[]; total: number }> {
  const offset = page * pageSize;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM listings
    WHERE nft_contract = $1 AND status = $2`;

  const listingsQuery = `
    SELECT *
    FROM listings
    WHERE nft_contract = $1 AND status = $2
    ORDER BY price::numeric ASC
    LIMIT $3 OFFSET $4`;

  const [countResult, listingsResult] = await Promise.all([
    pool.query(countQuery, [nftContract, status]),
    pool.query(listingsQuery, [nftContract, status, pageSize, offset]),
  ]);

  return {
    listings: listingsResult.rows,
    total: parseInt(countResult.rows[0].total),
  };
}

// Get listings by seller
export async function getSellerListings(
  seller: string,
  status: number = 1
): Promise<DBListing[]> {
  const query = `
    SELECT *
    FROM listings
    WHERE seller = $1 AND status = $2
    ORDER BY created_at DESC`;

  const result = await pool.query(query, [seller, status]);
  return result.rows;
}

// Get a single listing
export async function getListing(
  nftContract: string,
  tokenId: number
): Promise<DBListing | null> {
  const query = `
    SELECT *
    FROM listings
    WHERE nft_contract = $1 AND token_id = $2 AND status = 1`;

  const result = await pool.query(query, [nftContract, tokenId]);
  return result.rows[0] || null;
}
