// contracts/ignition/modules/deploy.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "ethers";

const DEFAULT_FEE = ethers.parseEther("0.001"); // 0.001 ETH
const MARKET_FEE = 250; // 2.5%

// Note: Since direct proxy deployment with init data is difficult in Ignition,
// we'll use a simpler approach where we deploy and initialize separately

export default buildModule("BasedMarketplace", (m) => {
  // Get deployer account
  const deployerAccount = m.getAccount(0);

  // Deploy implementation contracts (not used directly by users)
  const factoryImpl = m.contract("BasedCollectionFactory", []);
  const storageImpl = m.contract("BasedMarketplaceStorage", []);
  const marketplaceImpl = m.contract("BasedMarketplace", []);

  // Deploy non-upgradeable instances for Ignition's limitations
  // (In production, use the Hardhat script that properly deploys upgradeable instances)

  // Deploy BasedCollectionFactory with constructor
  const factory = m.contract("BasedCollectionFactory", []);
  const factoryInit = m.call(factory, "initialize", [
    DEFAULT_FEE,
    deployerAccount,
  ]);

  // Deploy BasedMarketplaceStorage
  const marketplaceStorage = m.contract("BasedMarketplaceStorage", []);
  const storageInit = m.call(marketplaceStorage, "initialize", []);

  // Deploy BasedMarketplace
  const marketplace = m.contract("BasedMarketplace", []);
  const marketplaceInit = m.call(
    marketplace,
    "initialize",
    [marketplaceStorage, MARKET_FEE],
    { after: [storageInit] }
  );

  // Transfer ownership of storage to marketplace
  const transferOwnership = m.call(
    marketplaceStorage,
    "transferOwnership",
    [marketplace],
    { after: [storageInit, marketplaceInit] }
  );

  // Create a sample collection
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
    }
  );

  return {
    // Implementation contracts (for reference)
    factoryImpl,
    storageImpl,
    marketplaceImpl,

    // Instances that will be used by users
    factory,
    marketplaceStorage,
    marketplace,
  };
});
