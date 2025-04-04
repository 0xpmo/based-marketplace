import { ethers } from "ethers";
import { sql } from "@vercel/postgres";
import MarketplaceABI from "../src/contracts/BasedSeaMarketplace.json";
import ERC721ABI from "../src/contracts/IERC721.json";
import ERC1155ABI from "../src/contracts/IERC1155.json";
import { generateERC1155ListingId } from "../src/lib/db";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration variables
const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const COLLECTIONS_TO_SYNC = process.env.COLLECTIONS_TO_SYNC?.split(",") || [];
const SYNC_BLOCK_RANGE = parseInt(process.env.SYNC_BLOCK_RANGE || "10000"); // Default ~24 hours of blocks
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100"); // Process this many tokens at once

// Interface for listing events
interface ListingEvent {
  seller: string;
  nftContract: string;
  tokenId: bigint;
  price: bigint;
  isPrivate: boolean;
  allowedBuyer: string;
  quantity: bigint;
  blockNumber: number;
}

// Get provider and contract instances
async function getProvider() {
  if (!RPC_URL) throw new Error("RPC_URL not configured");
  return new ethers.JsonRpcProvider(RPC_URL);
}

async function getMarketplaceContract() {
  if (!MARKETPLACE_ADDRESS)
    throw new Error("MARKETPLACE_ADDRESS not configured");
  const provider = await getProvider();
  return new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, provider);
}

// Get events from the marketplace
async function getListingEvents(
  fromBlock: number,
  toBlock: number
): Promise<ListingEvent[]> {
  console.log(`Getting listing events from block ${fromBlock} to ${toBlock}`);
  const marketplaceContract = await getMarketplaceContract();

  try {
    // Get ItemListed events
    const itemListedFilter = marketplaceContract.filters.ItemListed();
    const itemListedEvents = await marketplaceContract.queryFilter(
      itemListedFilter,
      fromBlock,
      toBlock
    );

    // Transform events into a more usable format
    return itemListedEvents.map((event) => ({
      seller: event.args.seller,
      nftContract: event.args.nftContract,
      tokenId: event.args.tokenId,
      price: event.args.price,
      isPrivate: event.args.isPrivate,
      allowedBuyer: event.args.allowedBuyer,
      quantity: event.args.quantity,
      blockNumber: event.blockNumber,
    }));
  } catch (error) {
    console.error("Error fetching listing events:", error);
    return [];
  }
}

// Get cancel/sold events to track status changes
async function getStatusChangeEvents(fromBlock: number, toBlock: number) {
  console.log(
    `Getting status change events from block ${fromBlock} to ${toBlock}`
  );
  const marketplaceContract = await getMarketplaceContract();

  try {
    // Get ItemCanceled events
    const cancelFilter = marketplaceContract.filters.ItemCanceled();
    const cancelEvents = await marketplaceContract.queryFilter(
      cancelFilter,
      fromBlock,
      toBlock
    );

    // Get ItemSold events
    const soldFilter = marketplaceContract.filters.ItemSold();
    const soldEvents = await marketplaceContract.queryFilter(
      soldFilter,
      fromBlock,
      toBlock
    );

    return {
      canceled: cancelEvents.map((event) => ({
        seller: event.args.seller,
        nftContract: event.args.nftContract,
        tokenId: event.args.tokenId,
        blockNumber: event.blockNumber,
      })),
      sold: soldEvents.map((event) => ({
        seller: event.args.seller,
        buyer: event.args.buyer,
        nftContract: event.args.nftContract,
        tokenId: event.args.tokenId,
        price: event.args.price,
        blockNumber: event.blockNumber,
      })),
    };
  } catch (error) {
    console.error("Error fetching status change events:", error);
    return { canceled: [], sold: [] };
  }
}

// Check if a contract supports a particular interface
async function supportsInterface(contractAddress: string, interfaceId: string) {
  const provider = await getProvider();
  const contract = new ethers.Contract(
    contractAddress,
    [
      "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
    ],
    provider
  );

  try {
    return await contract.supportsInterface(interfaceId);
  } catch (error) {
    console.error(
      `Error checking interface support for ${contractAddress}:`,
      error
    );
    return false;
  }
}

// Process ERC721 listings
async function processERC721Listings(
  events: ListingEvent[],
  nftContract: string,
  canceledEvents: any[],
  soldEvents: any[]
) {
  const provider = await getProvider();
  const erc721Contract = new ethers.Contract(nftContract, ERC721ABI, provider);
  const marketplaceContract = await getMarketplaceContract();

  // Group events by token ID to process only the latest state
  const tokenEvents = new Map<string, ListingEvent>();

  // First, get the latest listing event for each token
  for (const event of events) {
    if (event.nftContract.toLowerCase() === nftContract.toLowerCase()) {
      const tokenId = event.tokenId.toString();
      if (
        !tokenEvents.has(tokenId) ||
        tokenEvents.get(tokenId)!.blockNumber < event.blockNumber
      ) {
        tokenEvents.set(tokenId, event);
      }
    }
  }

  console.log(
    `Processing ${tokenEvents.size} ERC721 tokens from ${nftContract}`
  );

  // Process in batches to avoid rate limiting
  const tokenIds = Array.from(tokenEvents.keys());
  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (tokenId) => {
        const event = tokenEvents.get(tokenId)!;

        // Check if token was canceled or sold
        const wasCanceled = canceledEvents.some(
          (e) =>
            e.nftContract.toLowerCase() === nftContract.toLowerCase() &&
            e.tokenId.toString() === tokenId &&
            e.blockNumber > event.blockNumber
        );

        const wasSold = soldEvents.some(
          (e) =>
            e.nftContract.toLowerCase() === nftContract.toLowerCase() &&
            e.tokenId.toString() === tokenId &&
            e.blockNumber > event.blockNumber
        );

        if (wasCanceled || wasSold) {
          // No need to check current state if we know it's been canceled or sold
          const status = wasSold ? "Sold" : "Canceled";
          await updateListingInDb(event, status, false, tokenId);
          return;
        }

        try {
          // Get current state from the marketplace contract
          const listing = await marketplaceContract.getListing(
            nftContract,
            tokenId
          );

          // Only proceed if listing is active (status = 1)
          if (listing && listing.status === 1) {
            try {
              // Verify the seller still owns the NFT
              const currentOwner = await erc721Contract.ownerOf(tokenId);

              if (currentOwner.toLowerCase() === listing.seller.toLowerCase()) {
                // Listing is valid, insert or update in database
                await updateListingInDb(event, "Active", false, tokenId);
              } else {
                // Owner has changed, mark as canceled
                await updateListingInDb(event, "Canceled", false, tokenId);
              }
            } catch (error) {
              console.error(
                `Error verifying ownership for token ${tokenId}:`,
                error
              );
              // If we can't verify ownership, mark as canceled to be safe
              await updateListingInDb(event, "Canceled", false, tokenId);
            }
          } else {
            // Listing not active in contract, mark as canceled
            await updateListingInDb(event, "Canceled", false, tokenId);
          }
        } catch (error) {
          console.error(`Error processing ERC721 token ${tokenId}:`, error);
        }
      })
    );

    console.log(
      `Processed batch ${i / BATCH_SIZE + 1}/${Math.ceil(
        tokenIds.length / BATCH_SIZE
      )}`
    );
  }
}

// Process ERC1155 listings
async function processERC1155Listings(
  events: ListingEvent[],
  nftContract: string,
  canceledEvents: any[],
  soldEvents: any[]
) {
  const provider = await getProvider();
  const erc1155Contract = new ethers.Contract(
    nftContract,
    ERC1155ABI,
    provider
  );
  const marketplaceContract = await getMarketplaceContract();

  // Group by token ID and seller to process only the latest state
  const sellerTokenEvents = new Map<string, ListingEvent>();

  // First, get the latest listing event for each token and seller combination
  for (const event of events) {
    if (event.nftContract.toLowerCase() === nftContract.toLowerCase()) {
      const key = `${event.tokenId.toString()}_${event.seller.toLowerCase()}`;
      if (
        !sellerTokenEvents.has(key) ||
        sellerTokenEvents.get(key)!.blockNumber < event.blockNumber
      ) {
        sellerTokenEvents.set(key, event);
      }
    }
  }

  console.log(
    `Processing ${sellerTokenEvents.size} ERC1155 token listings from ${nftContract}`
  );

  // Process in batches
  const keys = Array.from(sellerTokenEvents.keys());
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    const batch = keys.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (key) => {
        const [tokenId, seller] = key.split("_");
        const event = sellerTokenEvents.get(key)!;

        // Check if token was canceled or sold
        const wasCanceled = canceledEvents.some(
          (e) =>
            e.nftContract.toLowerCase() === nftContract.toLowerCase() &&
            e.tokenId.toString() === tokenId &&
            e.seller.toLowerCase() === seller &&
            e.blockNumber > event.blockNumber
        );

        const wasSold = soldEvents.some(
          (e) =>
            e.nftContract.toLowerCase() === nftContract.toLowerCase() &&
            e.tokenId.toString() === tokenId &&
            e.seller.toLowerCase() === seller &&
            e.blockNumber > event.blockNumber
        );

        if (wasCanceled || wasSold) {
          // No need to check current state if we know it's been canceled or sold
          const status = wasSold ? "Sold" : "Canceled";
          await updateListingInDb(event, status, true, tokenId);
          return;
        }

        try {
          // Calculate the listing ID for ERC1155
          const listingId = generateERC1155ListingId(tokenId, seller);

          // Get current state from the marketplace contract
          const listing = await marketplaceContract.getListing(
            nftContract,
            listingId
          );

          // Only proceed if listing is active (status = 1)
          if (listing && listing.status === 1) {
            try {
              // Verify the seller still has enough tokens
              const balance = await erc1155Contract.balanceOf(seller, tokenId);

              if (balance >= listing.quantity) {
                // Listing is valid, insert or update in database
                await updateListingInDb(
                  event,
                  "Active",
                  true,
                  tokenId,
                  listingId
                );
              } else {
                // Insufficient balance, mark as canceled
                await updateListingInDb(
                  event,
                  "Canceled",
                  true,
                  tokenId,
                  listingId
                );
              }
            } catch (error) {
              console.error(
                `Error verifying balance for token ${tokenId}, seller ${seller}:`,
                error
              );
              // If we can't verify balance, mark as canceled to be safe
              await updateListingInDb(
                event,
                "Canceled",
                true,
                tokenId,
                listingId
              );
            }
          } else {
            // Listing not active in contract, mark as canceled
            await updateListingInDb(
              event,
              "Canceled",
              true,
              tokenId,
              listingId
            );
          }
        } catch (error) {
          console.error(
            `Error processing ERC1155 token ${tokenId}, seller ${seller}:`,
            error
          );
        }
      })
    );

    console.log(
      `Processed batch ${i / BATCH_SIZE + 1}/${Math.ceil(
        keys.length / BATCH_SIZE
      )}`
    );
  }
}

// Update listing in database
async function updateListingInDb(
  event: ListingEvent,
  status: "Active" | "Sold" | "Canceled",
  isERC1155: boolean,
  originalTokenId: string,
  listingId?: string
) {
  try {
    // For ERC1155, use the computed listingId, otherwise use the tokenId
    const dbListingId = isERC1155 ? listingId : event.tokenId.toString();

    // Create a unique ID for the database entry
    const id = `${event.nftContract.toLowerCase()}_${originalTokenId}_${event.seller.toLowerCase()}`;

    await sql`
      INSERT INTO listings (
        id, nft_contract, token_id, seller, price, 
        quantity, is_private, allowed_buyer, status, 
        listing_id, is_erc1155, timestamp
      ) VALUES (
        ${id},
        ${event.nftContract.toLowerCase()},
        ${originalTokenId},
        ${event.seller.toLowerCase()},
        ${event.price.toString()},
        ${event.quantity.toString()},
        ${event.isPrivate},
        ${event.allowedBuyer},
        ${status},
        ${dbListingId},
        ${isERC1155},
        ${Date.now()}
      )
      ON CONFLICT (id) DO UPDATE SET
        price = ${event.price.toString()},
        quantity = ${event.quantity.toString()},
        is_private = ${event.isPrivate},
        allowed_buyer = ${event.allowedBuyer},
        status = ${status},
        timestamp = ${Date.now()}
    `;
  } catch (error) {
    console.error(`Error updating listing in database:`, error);
  }
}

// Main sync function for a collection
async function syncCollection(
  nftContract: string,
  fromBlock: number,
  toBlock: number
) {
  console.log(`Syncing collection ${nftContract}...`);

  try {
    // Check if collection is ERC721 or ERC1155
    const isERC1155 = await supportsInterface(nftContract, "0xd9b67a26");
    const isERC721 = await supportsInterface(nftContract, "0x80ac58cd");

    if (!isERC1155 && !isERC721) {
      console.log(
        `Collection ${nftContract} is neither ERC721 nor ERC1155, skipping...`
      );
      return;
    }

    // Get all market events
    const listingEvents = await getListingEvents(fromBlock, toBlock);
    const { canceled, sold } = await getStatusChangeEvents(fromBlock, toBlock);

    // Process based on contract type
    if (isERC721) {
      await processERC721Listings(listingEvents, nftContract, canceled, sold);
    } else {
      await processERC1155Listings(listingEvents, nftContract, canceled, sold);
    }

    console.log(`Sync completed for collection ${nftContract}`);
  } catch (error) {
    console.error(`Error syncing collection ${nftContract}:`, error);
  }
}

// Main function
async function main() {
  console.log("Starting marketplace listing synchronization...");

  if (COLLECTIONS_TO_SYNC.length === 0) {
    console.warn(
      "No collections configured to sync. Set COLLECTIONS_TO_SYNC in .env"
    );
  }

  try {
    // Get latest block for event filtering
    const provider = await getProvider();
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - SYNC_BLOCK_RANGE);

    console.log(`Syncing events from block ${fromBlock} to ${latestBlock}`);

    // Process each collection sequentially to avoid rate limiting
    for (const collection of COLLECTIONS_TO_SYNC) {
      const collectionAddress = collection.trim();
      if (ethers.isAddress(collectionAddress)) {
        await syncCollection(collectionAddress, fromBlock, latestBlock);
      } else {
        console.error(
          `Invalid collection address: ${collectionAddress}, skipping`
        );
      }
    }

    console.log("Marketplace synchronization completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error in main sync process:", error);
    process.exit(1);
  }
}

// Run the script
main();
