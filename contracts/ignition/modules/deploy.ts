// contracts/ignition/modules/deploy.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "ethers";

const DEFAULT_FEE = ethers.parseEther("0.001"); // 0.001 ETH
const MARKET_FEE = 250; // 2.5%

export default buildModule("PepeMarketplace", (m) => {
  // Deploy Collection Factory
  const factory = m.contract("PepeCollectionFactory", [
    DEFAULT_FEE,
    m.getAccount(0),
  ]);

  // Deploy Storage Contract first
  const marketplaceStorage = m.contract("PepeMarketplaceStorage", []);

  // Call initialize on storage contract
  const initializeStorage = m.call(marketplaceStorage, "initialize", []);

  // Deploy Marketplace with reference to storage
  const marketplace = m.contract("PepeMarketplace", []);

  // Initialize marketplace contract after it's deployed
  const initializeMarketplace = m.call(marketplace, "initialize", [
    marketplaceStorage,
    MARKET_FEE,
  ]);

  // Create a sample collection
  const createCollectionTx = m.call(
    factory,
    "createCollection",
    [
      "Coal Originals",
      "PEPE",
      "ipfs://QmaSnsrEapbbgmhUmsQn74phTvuyNouicT9XWFaWGcJPeW",
      ethers.parseEther("0.05"), // 0.05 ETH mint price
      100, // Max supply
      500, // 5% royalty
      true, // Enable minting
    ],
    {
      value: DEFAULT_FEE,
      from: m.getAccount(0), // Specify the account explicitly
    }
  );

  return { factory, marketplaceStorage, marketplace };
});
