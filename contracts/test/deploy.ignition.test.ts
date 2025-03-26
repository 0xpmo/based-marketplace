// contracts/test/deploy.ignition.test.ts
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
  BasedCollectionFactory,
  BasedMarketplace,
  BasedNFTCollection,
} from "../typechain-types";

describe("BasedMarketplace Ignition Deployment", function () {
  it("Should deploy the contracts correctly via Ignition", async function () {
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
      const marketplaceStorage = await ethers.getContractAt(
        "BasedMarketplaceStorage",
        await result.marketplaceStorage.getAddress()
      );
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

      // Access marketplace storage through ABI calls since type is not available
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
      const BasedNFTCollectionFactory = await ethers.getContractFactory(
        "BasedNFTCollection"
      );
      const sampleCollection = BasedNFTCollectionFactory.attach(
        sampleCollectionAddress
      ) as unknown as BasedNFTCollection;

      // Verify sample collection properties
      expect(await sampleCollection.name()).to.equal("Based Originals");
      expect(await sampleCollection.symbol()).to.equal("BASED");
      expect(await sampleCollection.collectionURI()).to.equal(
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
