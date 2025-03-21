// contracts/scripts/update-frontend-contracts.ts
import fs from "fs";
import path from "path";

async function main() {
  console.log("Updating frontend contract addresses...");

  // Get deployed contracts from ignition deployment
  const deploymentsPath = path.join(
    __dirname,
    "../ignition/deployments/chain-1337/deployed_addresses.json"
  );

  if (!fs.existsSync(deploymentsPath)) {
    console.error(
      "Deployment file not found. Make sure to deploy contracts first."
    );
    process.exit(1);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  // Extract contract addresses
  const factoryAddress = deployments["PepeMarketplace#PepeCollectionFactory"];
  const marketplaceAddress = deployments["PepeMarketplace#PepeMarketplace"];

  // Update the frontend config
  const web3ConfigPath = path.join(
    __dirname,
    "../../frontend/src/config/web3.ts"
  );
  let web3Config = fs.readFileSync(web3ConfigPath, "utf8");

  // Replace addresses
  web3Config = web3Config.replace(
    /export const FACTORY_ADDRESS = '[^']*'/,
    `export const FACTORY_ADDRESS = '${factoryAddress}'`
  );

  web3Config = web3Config.replace(
    /export const MARKETPLACE_ADDRESS = '[^']*'/,
    `export const MARKETPLACE_ADDRESS = '${marketplaceAddress}'`
  );

  // Write updated config
  fs.writeFileSync(web3ConfigPath, web3Config);

  // Update the .env file
  const envPath = path.join(__dirname, "../../frontend/.env");
  let envContent = fs.readFileSync(envPath, "utf8");

  // Replace addresses in env file
  envContent = envContent.replace(
    /NEXT_PUBLIC_FACTORY_ADDRESS=.*/,
    `NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`
  );

  envContent = envContent.replace(
    /NEXT_PUBLIC_MARKETPLACE_ADDRESS=.*/,
    `NEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketplaceAddress}`
  );

  // Write updated env file
  fs.writeFileSync(envPath, envContent);

  console.log("Frontend contract addresses updated successfully!");
  console.log(`Factory Address: ${factoryAddress}`);
  console.log(`Marketplace Address: ${marketplaceAddress}`);
}

main().catch((error) => {
  console.error("Failed to update frontend contracts:", error);
  process.exitCode = 1;
});
