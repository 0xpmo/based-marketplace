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

  // Deploy Marketplace
  const marketplace = m.contract("PepeMarketplace", [
    MARKET_FEE,
    m.getAccount(0),
  ]);

  // Create a sample collection
  m.call(
    factory,
    "createCollection",
    [
      "Coal Originals",
      "PEPE",
      "ipfs://QmaSnsrEapbbgmhUmsQn74phTvuyNouicT9XWFaWGcJPeW",
      ethers.parseEther("0.05"), // 0.05 ETH mint price
      100, // Max supply
      500, // 5% royalty
    ],
    { value: DEFAULT_FEE }
  );

  // Note: In Ignition, we can't directly use the return value to call methods on it
  // Collection minting will be disabled via frontend when creating new collections

  return { factory, marketplace };
});
