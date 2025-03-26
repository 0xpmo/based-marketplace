// contracts/scripts/copy-abis.ts
import fs from "fs";
import path from "path";

// Contract names
const contracts = [
  "BasedNFTCollection",
  "BasedCollectionFactory",
  "BasedMarketplace",
  "BasedMarketplaceStorage",
];

// Paths
const artifactsDir = path.join(__dirname, "../artifacts/contracts");
const targetDir = path.join(__dirname, "../../frontend/src/contracts");

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// For each contract
for (const contract of contracts) {
  // Read the artifact JSON
  const artifactPath = path.join(
    artifactsDir,
    `${contract}.sol/${contract}.json`
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Extract abi
  const { abi } = artifact;

  // Create a simplified version with just the ABI
  const simplified = {
    abi,
  };

  // Write to target directory
  const targetPath = path.join(targetDir, `${contract}.json`);
  fs.writeFileSync(targetPath, JSON.stringify(simplified, null, 2));

  console.log(`Copied ABI for ${contract} to ${targetPath}`);
}

console.log("All ABIs copied successfully");
