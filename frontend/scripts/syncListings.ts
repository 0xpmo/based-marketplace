import { ethers } from "ethers";
import { sql } from "@vercel/postgres";
import MarketplaceABI from "../src/contracts/BasedSeaMarketplace.json";
import ERC721ABI from "../src/contracts/IERC721.json";
import ERC1155ABI from "../src/contracts/IERC1155.json";
import { generateERC1155ListingId } from "../src/lib/db";

// Configure these addresses
const COLLECTIONS_TO_SYNC = [
  // Add your collection addresses here
  "0xYourCollection1Address",
  "0xYourCollection2Address",
];

const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;

async function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

async function getMarketplaceContract() {
  const provider = await getProvider();
  return new ethers.Contract(
    MARKETPLACE_ADDRESS!,
    MarketplaceABI.abi,
    provider
  );
}

async function syncERC721Listings(collectionAddress: string) {
  console.log(`Syncing ERC721 listings for collection ${collectionAddress}...`);

  const provider = await getProvider();
  const nftContract = new ethers.Contract(
    collectionAddress,
    ERC721ABI,
    provider
  );
  const marketplaceContract = await getMarketplaceContract();

  try {
    // Get the latest block for event filtering
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = latestBlock - 10000; // Last ~24 hours of blocks, adjust as needed

    // Get Transfer events to find all token IDs
    const transferFilter = nftContract.filters.Transfer();
    const transfers = await nftContract.queryFilter(
      transferFilter,
      fromBlock,
      latestBlock
    );

    // Get unique token IDs from transfers
    const uniqueTokenIds = new Set(
      transfers.map((event) => event.args?.tokenId.toString())
    );

    console.log(`Found ${uniqueTokenIds.size} unique tokens`);

    // Check each token's listing status
    for (const tokenId of uniqueTokenIds) {
      try {
        const listing = await marketplaceContract.getListing(
          collectionAddress,
          tokenId
        );

        if (listing && listing.status === 1) {
          // 1 = Active
          // Verify the seller still owns the NFT
          const currentOwner = await nftContract.ownerOf(tokenId);

          if (currentOwner.toLowerCase() === listing.seller.toLowerCase()) {
            // Insert or update the listing in our database
            await sql`
              INSERT INTO listings (
                id, nft_contract, token_id, seller, price, 
                quantity, is_private, allowed_buyer, status, 
                listing_id, is_erc1155, timestamp
              ) VALUES (
                ${`${collectionAddress}_${tokenId}_${listing.seller}`},
                ${collectionAddress},
                ${tokenId},
                ${listing.seller},
                ${listing.price.toString()},
                ${1}, -- ERC721 always has quantity 1
                ${listing.isPrivate},
                ${listing.allowedBuyer},
                ${"Active"},
                ${tokenId},
                ${false},
                ${Date.now()}
              )
              ON CONFLICT (id) DO UPDATE SET
                price = ${listing.price.toString()},
                status = ${"Active"},
                timestamp = ${Date.now()}
            `;
            console.log(`Synchronized listing for token ${tokenId}`);
          } else {
            // Owner has changed, mark any existing listing as canceled
            await sql`
              UPDATE listings 
              SET status = 'Canceled', 
                  timestamp = ${Date.now()}
              WHERE nft_contract = ${collectionAddress} 
                AND token_id = ${tokenId}
                AND status = 'Active'
            `;
            console.log(
              `Marked stale listing as canceled for token ${tokenId}`
            );
          }
        } else {
          // No active listing, ensure database reflects this
          await sql`
            UPDATE listings 
            SET status = 'Canceled', 
                timestamp = ${Date.now()}
            WHERE nft_contract = ${collectionAddress} 
              AND token_id = ${tokenId}
              AND status = 'Active'
          `;
        }
      } catch (err) {
        console.error(`Error processing token ${tokenId}:`, err);
      }
    }
  } catch (err) {
    console.error(`Error syncing collection ${collectionAddress}:`, err);
  }
}

async function syncERC1155Listings(collectionAddress: string) {
  console.log(
    `Syncing ERC1155 listings for collection ${collectionAddress}...`
  );

  const provider = await getProvider();
  const nftContract = new ethers.Contract(
    collectionAddress,
    ERC1155ABI,
    provider
  );
  const marketplaceContract = await getMarketplaceContract();

  try {
    // Get the latest block for event filtering
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = latestBlock - 10000; // Last ~24 hours of blocks, adjust as needed

    // Get TransferSingle and TransferBatch events to find all token IDs and holders
    const transferSingleFilter = nftContract.filters.TransferSingle();
    const transferBatchFilter = nftContract.filters.TransferBatch();

    const [singleTransfers, batchTransfers] = await Promise.all([
      nftContract.queryFilter(transferSingleFilter, fromBlock, latestBlock),
      nftContract.queryFilter(transferBatchFilter, fromBlock, latestBlock),
    ]);

    // Get unique token IDs and their holders
    const tokenHolders = new Map<string, Set<string>>();

    // Process TransferSingle events
    for (const event of singleTransfers) {
      const { id, to } = event.args!;
      const tokenId = id.toString();
      if (!tokenHolders.has(tokenId)) {
        tokenHolders.set(tokenId, new Set());
      }
      tokenHolders.get(tokenId)!.add(to.toLowerCase());
    }

    // Process TransferBatch events
    for (const event of batchTransfers) {
      const { ids, to } = event.args!;
      for (const id of ids) {
        const tokenId = id.toString();
        if (!tokenHolders.has(tokenId)) {
          tokenHolders.set(tokenId, new Set());
        }
        tokenHolders.get(tokenId)!.add(to.toLowerCase());
      }
    }

    console.log(`Found ${tokenHolders.size} unique tokens with holders`);

    // Check each token ID and holder combination for listings
    for (const [tokenId, holders] of tokenHolders) {
      for (const holder of holders) {
        try {
          // Calculate the unique listing ID
          const listingId = generateERC1155ListingId(tokenId, holder);

          const listing = await marketplaceContract.getListing(
            collectionAddress,
            listingId
          );

          if (listing && listing.status === 1) {
            // 1 = Active
            // Verify the seller still has enough tokens
            const balance = await nftContract.balanceOf(holder, tokenId);

            if (balance >= listing.quantity) {
              // Insert or update the listing in our database
              await sql`
                INSERT INTO listings (
                  id, nft_contract, token_id, seller, price, 
                  quantity, is_private, allowed_buyer, status, 
                  listing_id, is_erc1155, timestamp
                ) VALUES (
                  ${`${collectionAddress}_${tokenId}_${holder}`},
                  ${collectionAddress},
                  ${tokenId},
                  ${holder},
                  ${listing.price.toString()},
                  ${listing.quantity.toString()},
                  ${listing.isPrivate},
                  ${listing.allowedBuyer},
                  ${"Active"},
                  ${listingId.toString()},
                  ${true},
                  ${Date.now()}
                )
                ON CONFLICT (id) DO UPDATE SET
                  price = ${listing.price.toString()},
                  quantity = ${listing.quantity.toString()},
                  status = ${"Active"},
                  timestamp = ${Date.now()}
              `;
              console.log(
                `Synchronized ERC1155 listing for token ${tokenId} from holder ${holder}`
              );
            } else {
              // Holder doesn't have enough tokens, mark listing as canceled
              await sql`
                UPDATE listings 
                SET status = 'Canceled', 
                    timestamp = ${Date.now()}
                WHERE nft_contract = ${collectionAddress} 
                  AND token_id = ${tokenId}
                  AND seller = ${holder}
                  AND status = 'Active'
              `;
              console.log(
                `Marked stale ERC1155 listing as canceled for token ${tokenId} from holder ${holder}`
              );
            }
          }
        } catch (err) {
          console.error(
            `Error processing token ${tokenId} for holder ${holder}:`,
            err
          );
        }
      }
    }
  } catch (err) {
    console.error(
      `Error syncing ERC1155 collection ${collectionAddress}:`,
      err
    );
  }
}

async function main() {
  console.log("Starting listing synchronization...");

  for (const collectionAddress of COLLECTIONS_TO_SYNC) {
    try {
      // Detect if collection is ERC721 or ERC1155
      const provider = await getProvider();
      const contract = new ethers.Contract(
        collectionAddress,
        [
          "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
        ],
        provider
      );

      const isERC1155 = await contract.supportsInterface("0xd9b67a26");
      const isERC721 = await contract.supportsInterface("0x80ac58cd");

      if (isERC1155) {
        await syncERC1155Listings(collectionAddress);
      } else if (isERC721) {
        await syncERC721Listings(collectionAddress);
      } else {
        console.log(
          `Collection ${collectionAddress} is neither ERC721 nor ERC1155, skipping...`
        );
      }
    } catch (err) {
      console.error(`Error processing collection ${collectionAddress}:`, err);
    }
  }

  console.log("Listing synchronization completed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error in main:", err);
  process.exit(1);
});
