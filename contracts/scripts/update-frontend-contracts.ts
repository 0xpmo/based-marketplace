// contracts/scripts/update-frontend-contracts.ts
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

async function main() {
  console.log("Updating frontend contract addresses...");

  // Always read directly from the .env file instead of relying on process.env
  const deploymentEnvPath = path.join(__dirname, "../.env");
  let factoryAddress, marketplaceAddress;

  if (fs.existsSync(deploymentEnvPath)) {
    console.log(`Loading deployment addresses from ${deploymentEnvPath}`);
    // Read the .env file content directly
    const envContent = fs.readFileSync(deploymentEnvPath, "utf8");

    // Parse the .env file manually to get the latest values
    const envLines = envContent.split("\n");
    for (const line of envLines) {
      const [key, value] = line.split("=");
      if (key === "FACTORY_PROXY_ADDRESS") factoryAddress = value;
      if (key === "MARKETPLACE_ADDRESS") marketplaceAddress = value;
    }

    console.log("Parsed from .env file:");
    console.log(`Factory Address: ${factoryAddress}`);
    console.log(`Marketplace Address: ${marketplaceAddress}`);
  }

  // If environment variables aren't set, try to get from deployment file (for Ignition deployments)
  if (!factoryAddress || !marketplaceAddress) {
    console.log(
      "Environment variables not found, checking Ignition deployments..."
    );

    // Get the network argument
    const network =
      process.argv.find((arg) => arg.startsWith("--network="))?.split("=")[1] ||
      process.argv[process.argv.indexOf("--network") + 1] ||
      "localhost";

    // Determine chain ID based on network
    const chainId = network === "localhost" ? "1337" : "84532"; // 84532 is Based chain ID

    // Get deployed contracts from ignition deployment
    const deploymentsPath = path.join(
      __dirname,
      `../ignition/deployments/chain-${chainId}/deployed_addresses.json`
    );

    if (!fs.existsSync(deploymentsPath)) {
      console.error(
        "Deployment file not found and no environment variables set. Make sure to deploy contracts first."
      );
      process.exit(1);
    }

    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

    // Extract contract addresses
    factoryAddress =
      deployments["BasedSeaMarketplace#BasedSeaCollectionFactory"];
    marketplaceAddress = deployments["BasedSeaMarketplace#BasedSeaMarketplace"];

    console.log("Using addresses from Ignition deployment");
  } else {
    console.log(
      "Using addresses from environment variables (upgradeable deployment)"
    );
  }

  console.log(`Factory Address: ${factoryAddress}`);
  console.log(`Marketplace Address: ${marketplaceAddress}`);

  // Update the frontend config
  const web3ConfigPath = path.join(
    __dirname,
    "../../frontend/src/config/web3.ts"
  );

  if (!fs.existsSync(web3ConfigPath)) {
    console.log("Creating web3.ts config file...");
    const configContent = `// Contract addresses
export const FACTORY_ADDRESS = '${factoryAddress}';
export const MARKETPLACE_ADDRESS = '${marketplaceAddress}';
`;
    fs.writeFileSync(web3ConfigPath, configContent);
  } else {
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
  }

  // Update the .env.local file
  const envPath = path.join(__dirname, "../../frontend/.env.local");

  if (!fs.existsSync(envPath)) {
    console.log("Creating .env.local file...");
    const envContent = `NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}
NEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketplaceAddress}
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
`;
    fs.writeFileSync(envPath, envContent);
  } else {
    let envContent = fs.readFileSync(envPath, "utf8");

    // Check if the variables exist in the file
    if (!envContent.includes("NEXT_PUBLIC_FACTORY_ADDRESS")) {
      envContent += `\nNEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`;
    } else {
      // Replace addresses in env file
      envContent = envContent.replace(
        /NEXT_PUBLIC_FACTORY_ADDRESS=.*/,
        `NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`
      );
    }

    if (!envContent.includes("NEXT_PUBLIC_MARKETPLACE_ADDRESS")) {
      envContent += `\nNEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketplaceAddress}`;
    } else {
      envContent = envContent.replace(
        /NEXT_PUBLIC_MARKETPLACE_ADDRESS=.*/,
        `NEXT_PUBLIC_MARKETPLACE_ADDRESS=${marketplaceAddress}`
      );
    }

    // Write updated env file
    fs.writeFileSync(envPath, envContent);
  }

  console.log("Frontend contract addresses updated successfully!");
  console.log(`Factory Address: ${factoryAddress}`);
  console.log(`Marketplace Address: ${marketplaceAddress}`);
}

main().catch((error) => {
  console.error("Failed to update frontend contracts:", error);
  process.exitCode = 1;
});
