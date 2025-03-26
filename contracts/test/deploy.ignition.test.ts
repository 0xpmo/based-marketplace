// contracts/test/deploy.ignition.test.ts
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
  BasedCollectionFactory,
  BasedMarketplace,
  BasedMarketplaceStorage,
} from "../typechain-types";

// NOTE: This test uses direct contract deployments rather than proxy deployments
// In production, use the proper upgrade deployment script in scripts/deploy-marketplace.ts
describe("BasedMarketplace Ignition Deployment (Test Only)", function () {
  // Skip this test for now as Ignition has limitations with initialization of upgradeable contracts
  // For production deployment, use the deploy-marketplace.ts script which properly handles upgradeable contracts
  it.skip("Should deploy the contracts correctly via Ignition for testing", async function () {
    // Get the deployment module
    const module = await import("../ignition/modules/deploy");

    console.log("Starting deployment test...");

    try {
      // Deploy the contracts using Ignition
      console.log("Deploying contracts with Ignition...");
      const result = await hre.ignition.deploy(module.default);
      console.log("Deployment successful!");

      // Access the deployed contracts
      console.log("Accessing deployed contracts...");
      const factory = result.factory as unknown as BasedCollectionFactory;
      const marketplaceStorage =
        result.marketplaceStorage as unknown as BasedMarketplaceStorage;
      const marketplace = result.marketplace as unknown as BasedMarketplace;

      // Verify the factory was deployed correctly
      console.log("Verifying factory deployment...");
      expect(await factory.getAddress()).to.be.properAddress;
      expect(await factory.creationFee()).to.equal(ethers.parseEther("0.001"));

      // Verify the storage was deployed correctly
      console.log("Verifying storage deployment...");
      expect(await marketplaceStorage.getAddress()).to.be.properAddress;
      expect(await marketplaceStorage.marketFee()).to.equal(250); // 2.5%
      expect(await marketplaceStorage.owner()).to.equal(
        await marketplace.getAddress()
      );

      // Verify marketplace is connected to storage
      console.log("Checking marketplace-storage connection...");
      const marketplaceStorageAddress = await marketplace.marketplaceStorage();
      expect(marketplaceStorageAddress).to.equal(
        await marketplaceStorage.getAddress()
      );

      // Verify the sample collection was created
      console.log("Verifying sample collection was created...");
      expect(await factory.getCollectionCount()).to.equal(1);

      const collections = await factory.getCollections();
      expect(collections.length).to.equal(1);

      // Get the sample collection address
      const sampleCollectionAddress = collections[0];

      // Attach to the sample collection contract
      console.log("Checking sample collection properties...");
      const sampleCollection = await ethers.getContractAt(
        "BasedNFTCollection",
        sampleCollectionAddress
      );

      // Verify sample collection properties
      expect(await sampleCollection.name()).to.equal("Based Originals");
      expect(await sampleCollection.symbol()).to.equal("BASED");
      expect(await sampleCollection.baseURI()).to.equal(
        "ipfs://QmaSnsrEapbbgmhUmsQn74phTvuyNouicT9XWFaWGcJPeW/"
      );
      expect(await sampleCollection.contractURI()).to.equal(
        "ipfs://QmaSnsrEapbbgmhUmsQn74phTvuyNouicT9XWFaWGcJPeW"
      );
      expect(await sampleCollection.mintPrice()).to.equal(
        ethers.parseEther("0.05")
      );
      expect(await sampleCollection.maxSupply()).to.equal(100);
      expect(await sampleCollection.royaltyFee()).to.equal(500);

      console.log("Test completed successfully!");
    } catch (error) {
      console.error("Deployment error:", error);
      throw error;
    }
  });
});
