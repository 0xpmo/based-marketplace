import fs from "fs";
import path from "path";
import { Collection, NFT, Trait } from "../types";

// Path to the nft-tools directory relative to the project root
const NFT_TOOLS_PATH = path.join(process.cwd(), "..", "nft-tools");

/**
 * Gets all collections from the nft-tools directory
 */
export async function getToolsCollections(): Promise<Collection[]> {
  try {
    // Look directly in the nft-tools directory for collection folders
    // instead of in a collections subdirectory
    const nftToolsDir = NFT_TOOLS_PATH;
    console.log("nftToolsDir", nftToolsDir);

    // If the directory doesn't exist, return empty array
    if (!fs.existsSync(nftToolsDir)) {
      console.warn("NFT tools directory not found:", nftToolsDir);
      return [];
    }

    // Read all directories in nft-tools folder
    const collections: Collection[] = [];
    const potentialCollectionFolders = fs.readdirSync(nftToolsDir);

    for (const folder of potentialCollectionFolders) {
      // Skip the essential tool directories that aren't collections
      if (["node_modules", "docs", "templates", "contracts"].includes(folder))
        continue;

      const collectionPath = path.join(nftToolsDir, folder);

      // Skip if not a directory
      if (!fs.statSync(collectionPath).isDirectory()) continue;

      // Check for collection config to verify this is a collection folder
      const configPath = path.join(collectionPath, "collection-config.json");
      if (!fs.existsSync(configPath)) continue;

      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

      // Read deployment info if available
      let deploymentInfo = null;
      const deploymentPath = path.join(collectionPath, "deployment-info.json");
      if (fs.existsSync(deploymentPath)) {
        deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      }

      // Check if collection metadata exists
      let collectionMetadata = null;
      const metadataPath = path.join(
        collectionPath,
        "assets",
        "metadata",
        "collection.json"
      );
      if (fs.existsSync(metadataPath)) {
        collectionMetadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      }

      // Create collection object
      collections.push({
        id: folder,
        name: config.name,
        symbol: config.symbol,
        description: config.description,
        external_link: config.external_link,
        image: collectionMetadata?.image || null,
        contract_address: deploymentInfo?.contractAddress,
        max_supply: config.max_supply,
        mint_price: config.mint_price,
        creator: deploymentInfo?.owner || config.fee_recipient,
        items_count: countCollectionItems(collectionPath),
      });
    }

    return collections;
  } catch (error) {
    console.error("Error reading collections:", error);
    return [];
  }
}

/**
 * Get a specific collection by ID
 */
export async function getToolsCollection(
  id: string
): Promise<Collection | null> {
  const collections = await getToolsCollections();
  return collections.find((c) => c.id === id) || null;
}

/**
 * Get NFTs for a specific collection
 */
export async function getToolsCollectionNFTs(
  collectionId: string
): Promise<NFT[]> {
  try {
    const collectionPath = path.join(NFT_TOOLS_PATH, collectionId);

    // If the collection doesn't exist, return empty array
    if (!fs.existsSync(collectionPath)) {
      console.warn("Collection not found:", collectionId);
      return [];
    }

    const metadataDir = path.join(collectionPath, "assets", "metadata");
    if (!fs.existsSync(metadataDir)) {
      console.warn(
        "Metadata directory not found for collection:",
        collectionId
      );
      return [];
    }

    // Read all JSON files in the metadata directory
    const nfts: NFT[] = [];
    const files = fs.readdirSync(metadataDir);

    for (const file of files) {
      // Skip non-JSON files and collection.json
      if (
        !file.endsWith(".json") ||
        file === "collection.json" ||
        file === "metadata-template.json"
      )
        continue;

      const filePath = path.join(metadataDir, file);
      const metadata = JSON.parse(fs.readFileSync(filePath, "utf8"));

      // Extract token ID from filename
      const tokenId = parseInt(file.replace(".json", ""));
      if (isNaN(tokenId)) continue;

      // Create NFT object
      nfts.push({
        id: `${collectionId}-${tokenId}`,
        name: metadata.name,
        description: metadata.description,
        image: metadata.image,
        external_url: metadata.external_url,
        attributes: metadata.attributes as Trait[],
        collection_id: collectionId,
        token_id: tokenId,
      });
    }

    // Sort by token ID
    return nfts.sort((a, b) => a.token_id - b.token_id);
  } catch (error) {
    console.error("Error reading collection NFTs:", error);
    return [];
  }
}

/**
 * Get a specific NFT by collection ID and token ID
 */
export async function getToolsNFT(
  collectionId: string,
  tokenId: string
): Promise<NFT | null> {
  const nfts = await getToolsCollectionNFTs(collectionId);
  return nfts.find((nft) => nft.token_id.toString() === tokenId) || null;
}

/**
 * Count the number of items (NFTs) in a collection
 */
function countCollectionItems(collectionPath: string): number {
  try {
    const metadataDir = path.join(collectionPath, "assets", "metadata");
    if (!fs.existsSync(metadataDir)) return 0;

    // Count JSON files, excluding collection.json and metadata-template.json
    return fs
      .readdirSync(metadataDir)
      .filter(
        (file) =>
          file.endsWith(".json") &&
          file !== "collection.json" &&
          file !== "metadata-template.json"
      ).length;
  } catch (error) {
    console.error("Error counting collection items:", error);
    return 0;
  }
}
