import { ethers } from "ethers";
import { sql } from "@vercel/postgres";
import MarketplaceABI from "../src/contracts/BasedSeaMarketplace.json";
import ERC721ABI from "../src/contracts/IERC721.json";
import ERC1155ABI from "../src/contracts/IERC1155.json";
import { generateERC1155ListingId } from "../src/lib/db";
import { EventLog, Log } from "ethers";

// npx ts-node --esm frontend/scripts/syncMarketplaceListings.ts

// Configuration variables
const MARKETPLACE_ADDRESS = "0x4bf5a404966BC8A7866Cd35912B94860336BF208";
const RPC_URL = "https://mainnet.basedaibridge.com/rpc/";
const COLLECTIONS_TO_SYNC = ["0xD480F4a34a1740a5B6fD2Da0d3C6CC6A432B56F2"];
const SYNC_BLOCK_RANGE = parseInt("70000"); // ~1 week of blocks (~10,000 blocks per day)
const BATCH_SIZE = parseInt("100"); // Process this many tokens at once
const LOG_CHUNK_SIZE = 2000; // Query this many blocks at a time for logs to avoid timeout

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

// Interface for canceled events
interface CanceledEvent {
  seller: string;
  nftContract: string;
  tokenId: bigint;
  blockNumber: number;
}

// Interface for sold events
interface SoldEvent {
  seller: string;
  buyer: string;
  nftContract: string;
  tokenId: bigint;
  price: bigint;
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
  const provider = await getProvider(); // Get provider directly
  let allEvents: ListingEvent[] = [];

  try {
    // Log contract address for verification
    console.log(`Marketplace address: ${MARKETPLACE_ADDRESS}`);

    // Define both old and new event signatures
    const oldEventSignature =
      "ItemListed(address,address,uint256,uint256,bool,address)";
    const newEventSignature =
      "ItemListed(address,address,uint256,uint256,bool,address,uint256)";

    const oldEventTopic = ethers.id(oldEventSignature);
    const newEventTopic = ethers.id(newEventSignature);

    console.log("Old ItemListed event signature:", oldEventSignature);
    console.log("Old ItemListed event topic:", oldEventTopic);
    console.log("New ItemListed event signature:", newEventSignature);
    console.log("New ItemListed event topic:", newEventTopic);

    // Process in chunks to avoid timeout - use smaller chunk size for listing events
    const listingChunkSize = 5000; // Smaller chunk for listings

    // Try both event signatures
    for (
      let chunkStart = fromBlock;
      chunkStart <= toBlock;
      chunkStart += listingChunkSize
    ) {
      const chunkEnd = Math.min(chunkStart + listingChunkSize - 1, toBlock);
      console.log(`  Querying chunk ${chunkStart} to ${chunkEnd}`);

      // Try old event signature first
      console.log("  Searching for old event signature");
      const oldTopicEvents = await provider.getLogs({
        address: MARKETPLACE_ADDRESS,
        topics: [oldEventTopic],
        fromBlock: chunkStart,
        toBlock: chunkEnd,
      });

      console.log(`  Old format events found: ${oldTopicEvents.length}`);

      if (oldTopicEvents.length > 0) {
        console.log(`  First old event:`, oldTopicEvents[0]);

        // Parse old format events
        const oldParsedEvents = oldTopicEvents
          .map((log: Log) => {
            try {
              // Manual parsing for old format - skip ABI parsing which doesn't work
              const seller = "0x" + log.topics[1].slice(26).toLowerCase();
              const nftContract = "0x" + log.topics[2].slice(26).toLowerCase();

              // Parse data field - it contains tokenId(uint256), price(uint256), isPrivate(bool), allowedBuyer(address)
              // First 32 bytes (64 chars) is tokenId
              const tokenIdHex = log.data.slice(0, 66);
              const tokenId = BigInt(tokenIdHex);

              // Next 32 bytes is price
              const priceHex = "0x" + log.data.slice(66, 130);
              const price = BigInt(priceHex);

              // Next 32 bytes is isPrivate (bool)
              const isPrivateHex = "0x" + log.data.slice(130, 194);
              const isPrivate = parseInt(isPrivateHex) === 1;

              // Last 32 bytes is allowedBuyer
              const allowedBuyerHex = "0x" + log.data.slice(194, 258);
              // Clean up any zero padding in the address
              const allowedBuyer =
                allowedBuyerHex ===
                "0x0000000000000000000000000000000000000000000000000000000000000000"
                  ? "0x0000000000000000000000000000000000000000"
                  : "0x" + allowedBuyerHex.slice(26);

              console.log(
                `  Successfully parsed old event: TokenID=${tokenId}, Price=${price}, Seller=${seller}`
              );

              return {
                seller,
                nftContract,
                tokenId,
                price,
                isPrivate,
                allowedBuyer,
                quantity: BigInt(1), // Default quantity for old event format
                blockNumber: log.blockNumber || 0,
              };
            } catch (manualErr) {
              console.log("Error manually parsing log:", manualErr);
              return null;
            }
          })
          .filter((event): event is ListingEvent => event !== null);

        console.log(`  Parsed ${oldParsedEvents.length} old format events`);
        allEvents = [...allEvents, ...oldParsedEvents];
      }

      // Now try new event signature
      console.log("  Searching for new event signature");
      const newTopicEvents = await provider.getLogs({
        address: MARKETPLACE_ADDRESS,
        topics: [newEventTopic],
        fromBlock: chunkStart,
        toBlock: chunkEnd,
      });

      console.log(`  New format events found: ${newTopicEvents.length}`);

      if (newTopicEvents.length > 0) {
        console.log(`  First new event:`, newTopicEvents[0]);

        // Parse new format events
        const newParsedEvents = newTopicEvents
          .map((log: Log) => {
            try {
              // Try to parse the event data
              const parsedLog = marketplaceContract.interface.parseLog({
                topics: log.topics as string[],
                data: log.data,
              });

              if (parsedLog) {
                return {
                  seller: parsedLog.args[0] || "",
                  nftContract: parsedLog.args[1] || "",
                  tokenId: parsedLog.args[2] || BigInt(0),
                  price: parsedLog.args[3] || BigInt(0),
                  isPrivate: parsedLog.args[4] || false,
                  allowedBuyer: parsedLog.args[5] || "",
                  quantity: parsedLog.args[6] || BigInt(1),
                  blockNumber: log.blockNumber || 0,
                };
              }
              return null;
            } catch (e) {
              console.log("Error parsing new format log:", e);
              return null;
            }
          })
          .filter((event): event is ListingEvent => event !== null);

        console.log(`  Parsed ${newParsedEvents.length} new format events`);
        allEvents = [...allEvents, ...newParsedEvents];
      }
    }

    console.log(`Total listing events found: ${allEvents.length}`);
    return allEvents;
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
  let allCancelEvents: (Log | EventLog)[] = [];
  let allSoldEvents: (Log | EventLog)[] = [];

  try {
    // Log event signatures
    console.log(
      "ItemCanceled event signature:",
      ethers.id("ItemCanceled(address,address,uint256)")
    );
    console.log(
      "ItemSold event signature:",
      ethers.id("ItemSold(address,address,address,uint256,uint256)")
    );

    // Process in chunks to avoid timeout
    for (
      let chunkStart = fromBlock;
      chunkStart <= toBlock;
      chunkStart += LOG_CHUNK_SIZE
    ) {
      const chunkEnd = Math.min(chunkStart + LOG_CHUNK_SIZE - 1, toBlock);
      console.log(`  Querying chunk ${chunkStart} to ${chunkEnd}`);

      // Use direct event signature approach
      const cancelEvents = await marketplaceContract.queryFilter(
        ethers.id("ItemCanceled(address,address,uint256)"),
        chunkStart,
        chunkEnd
      );

      // Get ItemSold events for this chunk
      const soldEvents = await marketplaceContract.queryFilter(
        ethers.id("ItemSold(address,address,address,uint256,uint256)"),
        chunkStart,
        chunkEnd
      );

      // Add to our collections
      allCancelEvents = [...allCancelEvents, ...cancelEvents];
      allSoldEvents = [...allSoldEvents, ...soldEvents];
      console.log(
        `  Found ${cancelEvents.length} cancel and ${soldEvents.length} sold events in this chunk`
      );
    }

    console.log(
      `Total events found: ${allCancelEvents.length} cancel, ${allSoldEvents.length} sold`
    );

    return {
      canceled: allCancelEvents.map((event): CanceledEvent => {
        const log = event as EventLog;
        const args = log.args || [];
        return {
          seller: args[0] || "",
          nftContract: args[1] || "",
          tokenId: args[2] || BigInt(0),
          blockNumber: event.blockNumber || 0,
        };
      }),
      sold: allSoldEvents.map((event): SoldEvent => {
        const log = event as EventLog;
        const args = log.args || [];
        return {
          seller: args[0] || "",
          buyer: args[1] || "",
          nftContract: args[2] || "",
          tokenId: args[3] || BigInt(0),
          price: args[4] || BigInt(0),
          blockNumber: event.blockNumber || 0,
        };
      }),
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
  canceledEvents: CanceledEvent[],
  soldEvents: SoldEvent[]
) {
  const provider = await getProvider();
  const erc721Contract = new ethers.Contract(
    nftContract,
    ERC721ABI.abi,
    provider
  );

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

        // Check if token was canceled or sold AFTER the listing event
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

        // Set status based on events
        let status: "Active" | "Sold" | "Canceled" = "Active";
        if (wasSold) {
          status = "Sold";
        } else if (wasCanceled) {
          status = "Canceled";
        } else {
          // Verify the seller still owns the NFT (basic check, not contract state)
          try {
            const currentOwner = await erc721Contract.ownerOf(tokenId);
            if (currentOwner.toLowerCase() !== event.seller.toLowerCase()) {
              // Owner has changed, mark as canceled/sold
              status = "Canceled"; // Assume canceled if owner changed
              console.log(
                `Token ${tokenId} has changed owners, marking as ${status}`
              );
            } else {
              console.log(
                `Token ${tokenId} still owned by ${event.seller}, marking as Active`
              );
            }
          } catch (error) {
            console.error(
              `Error checking ownership for token ${tokenId}:`,
              error
            );
            // Token might not exist or other error
            status = "Canceled";
          }
        }

        // Update the database with the determined status
        await updateListingInDb(event, status, false, tokenId);
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
  canceledEvents: CanceledEvent[],
  soldEvents: SoldEvent[]
) {
  const provider = await getProvider();
  const erc1155Contract = new ethers.Contract(
    nftContract,
    ERC1155ABI.abi,
    provider
  );

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
        const event = sellerTokenEvents.get(key)!;
        const tokenId = event.tokenId.toString();

        // Check if token was canceled or sold AFTER the listing event
        const wasCanceled = canceledEvents.some(
          (e) =>
            e.nftContract.toLowerCase() === nftContract.toLowerCase() &&
            e.tokenId.toString() === tokenId &&
            e.seller.toLowerCase() === event.seller.toLowerCase() &&
            e.blockNumber > event.blockNumber
        );

        const wasSold = soldEvents.some(
          (e) =>
            e.nftContract.toLowerCase() === nftContract.toLowerCase() &&
            e.tokenId.toString() === tokenId &&
            e.seller.toLowerCase() === event.seller.toLowerCase() &&
            e.blockNumber > event.blockNumber
        );

        // Set status based on events
        let status: "Active" | "Sold" | "Canceled" = "Active";
        if (wasSold) {
          status = "Sold";
        } else if (wasCanceled) {
          status = "Canceled";
        } else {
          // Verify the seller still has the tokens (basic check, not contract state)
          try {
            const balance = await erc1155Contract.balanceOf(
              event.seller,
              tokenId
            );
            if (balance < event.quantity) {
              // Balance is less than listed quantity, mark as partially sold
              status = "Sold";
              console.log(
                `Token ${tokenId} balance ${balance} < quantity ${event.quantity}, marking as ${status}`
              );
            } else {
              console.log(
                `Token ${tokenId} balance ${balance} >= quantity ${event.quantity}, marking as Active`
              );
            }
          } catch (error) {
            console.error(
              `Error checking balance for token ${tokenId}:`,
              error
            );
            // Token might not exist or other error
            status = "Canceled";
          }
        }

        // Update the database with the determined status
        await updateListingInDb(
          event,
          status,
          true,
          generateERC1155ListingId(
            event.tokenId.toString(),
            event.seller.toLowerCase()
          )
        );
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

  // Test database connection
  try {
    const result = await sql`SELECT NOW() as time`;
    console.log("Database connection successful:", result.rows[0].time);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }

  if (COLLECTIONS_TO_SYNC.length === 0) {
    console.warn(
      "No collections configured to sync. Set COLLECTIONS_TO_SYNC in .env"
    );
  }

  try {
    // Get latest block for event filtering
    const provider = await getProvider();
    const latestBlock = await provider.getBlockNumber();

    // Check if we should sync from the beginning (block 0)
    const syncFromBeginning = process.env.SYNC_FROM_BEGINNING === "true";
    const fromBlock = syncFromBeginning
      ? 0
      : Math.max(0, latestBlock - SYNC_BLOCK_RANGE);

    console.log(`Syncing events from block ${fromBlock} to ${latestBlock}`);
    console.log(`Sync mode: ${syncFromBeginning ? "ALL BLOCKS" : "LAST WEEK"}`);

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
