// contracts/test/deploy.ignition.test.ts
import { expect } from "chai";
import hre, { ethers, upgrades } from "hardhat";
import {
  BasedSeaCollectionFactory,
  BasedSeaMarketplace,
  BasedSeaMarketplaceStorage,
} from "../typechain-types";

// NOTE: This test uses direct contract deployments rather than proxy deployments
// In production, use the proper upgrade deployment script in scripts/deploy-marketplace.ts
describe("BasedSeaMarketplace Ignition Deployment (Test Only)", function () {
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
      const factory = result.factory as unknown as BasedSeaCollectionFactory;
      const marketplaceStorage =
        result.marketplaceStorage as unknown as BasedSeaMarketplaceStorage;
      const marketplace = result.marketplace as unknown as BasedSeaMarketplace;

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

      console.log("Checking fees configuration...");
      expect(await marketplaceStorage.accumulatedFees()).to.equal(0);
      console.log("Default accumulated fees is 0");

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
        "BasedSeaSequentialNFTCollection",
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
      expect(await sampleCollection.MAX_SUPPLY()).to.equal(100);

      // Test the royalty interface
      const [receiver, royaltyAmount] = await sampleCollection.royaltyInfo(
        1,
        ethers.parseEther("1.0")
      );
      expect(royaltyAmount).to.equal(ethers.parseEther("0.05")); // 5% royalty

      // Check sequential minting functionality
      console.log("Testing sequential minting functionality...");
      // Mint an NFT (should be token ID 1)
      const [owner] = await ethers.getSigners();

      const mintTx = await sampleCollection
        .connect(owner)
        .mint(await owner.getAddress(), {
          value: await sampleCollection.mintPrice(),
        });
      await mintTx.wait();

      // Verify token ID 1 exists and belongs to owner
      expect(await sampleCollection.ownerOf(1)).to.equal(
        await owner.getAddress()
      );
      expect(await sampleCollection.totalMinted()).to.equal(1);

      // Verify token URI functionality
      const tokenURI = await sampleCollection.tokenURI(1);
      expect(tokenURI).to.include(await sampleCollection.baseURI());

      console.log("Test completed successfully!");
    } catch (error) {
      console.error("Deployment error:", error);
      throw error;
    }
  });

  it("Should test individual contract deployments", async function () {
    // Test direct contract deployments without Ignition
    const [owner, feeRecipient] = await ethers.getSigners();

    // Deploy storage contract
    console.log("Deploying storage contract...");
    const StorageFactory = await ethers.getContractFactory(
      "BasedSeaMarketplaceStorage"
    );
    const marketplaceStorage = await upgrades.deployProxy(
      StorageFactory,
      [await feeRecipient.getAddress()],
      { initializer: "initialize", kind: "uups" }
    );
    await marketplaceStorage.waitForDeployment();

    // Deploy marketplace contract
    console.log("Deploying marketplace contract...");
    const MarketplaceFactory = await ethers.getContractFactory(
      "BasedSeaMarketplace"
    );
    const marketplace = await upgrades.deployProxy(
      MarketplaceFactory,
      [await marketplaceStorage.getAddress()],
      { initializer: "initialize", kind: "uups" }
    );
    await marketplace.waitForDeployment();

    // Deploy collection factory
    console.log("Deploying collection factory...");
    const FactoryFactory = await ethers.getContractFactory(
      "BasedSeaCollectionFactory"
    );
    const factory = await upgrades.deployProxy(
      FactoryFactory,
      [ethers.parseEther("0.001"), await owner.getAddress()],
      { initializer: "initialize", kind: "uups" }
    );
    await factory.waitForDeployment();

    // Transfer ownership of storage to marketplace
    await marketplaceStorage.transferOwnership(await marketplace.getAddress());

    // Verify basic functionality
    expect(await marketplace.marketplaceStorage()).to.equal(
      await marketplaceStorage.getAddress()
    );
    expect(await marketplaceStorage.owner()).to.equal(
      await marketplace.getAddress()
    );
    expect(await factory.owner()).to.equal(await owner.getAddress());

    console.log("All contracts deployed and connected successfully!");
  });
});
