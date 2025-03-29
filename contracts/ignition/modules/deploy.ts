// contracts/ignition/modules/deploy.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "ethers";

const DEFAULT_FEE = ethers.parseEther("0.001"); // 0.001 ETH
const MARKET_FEE = 450; // 4.5%

// For testing purposes only - In production, use the Hardhat deployProxy script
export default buildModule("BasedMarketplace", (m) => {
  // Get deployer account
  const deployerAccount = m.getAccount(0);

  // For testing, we'll use direct contract deployments
  // In production, use the proper upgrade deployment script

  // Deploy factory contract
  const factory = m.contract("BasedCollectionFactory", [], { id: "Factory" });

  // Deploy storage contract
  const marketplaceStorage = m.contract("BasedMarketplaceStorage", [], {
    id: "Storage",
  });

  // Deploy marketplace contract
  const marketplace = m.contract("BasedMarketplace", [], { id: "Marketplace" });

  // Initialize factory
  const factoryInit = m.call(
    factory,
    "initialize",
    [DEFAULT_FEE, deployerAccount],
    { id: "FactoryInit" }
  );

  // Initialize storage
  const storageInit = m.call(marketplaceStorage, "initialize", [], {
    id: "StorageInit",
  });

  // Initialize marketplace
  const marketplaceInit = m.call(
    marketplace,
    "initialize",
    [marketplaceStorage, MARKET_FEE],
    { id: "MarketplaceInit", after: [storageInit] }
  );

  // Transfer ownership of storage to marketplace
  const transferOwnership = m.call(
    marketplaceStorage,
    "transferOwnership",
    [marketplace],
    { id: "TransferOwnership", after: [storageInit, marketplaceInit] }
  );

  // For testing purposes, we'll create a sample collection
  const createCollectionTx = m.call(
    factory,
    "createCollection",
    [
      "Based Originals",
      "BASED",
      "ipfs://QmaSnsrEapbbgmhUmsQn74phTvuyNouicT9XWFaWGcJPeW",
      ethers.parseEther("0.05"), // 0.05 ETH mint price
      100, // Max supply
      500, // 5% royalty
      true, // Enable minting
    ],
    {
      value: DEFAULT_FEE,
      from: deployerAccount,
      after: [factoryInit, transferOwnership],
      id: "CreateSampleCollection",
    }
  );

  return {
    factory,
    marketplaceStorage,
    marketplace,
  };
});
