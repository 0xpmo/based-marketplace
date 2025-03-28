// contracts/test/BasedSeaCollectionFactory.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  BasedSeaCollectionFactory,
  BasedSeaSequentialNFTCollection,
} from "../typechain-types";
import { Signer } from "ethers";

describe("BasedSeaCollectionFactory", function () {
  let factory: BasedSeaCollectionFactory;
  let owner: Signer;
  let creator: Signer;
  let ownerAddress: string;
  let creatorAddress: string;

  const creationFee = ethers.parseEther("0.01");

  beforeEach(async function () {
    [owner, creator] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    creatorAddress = await creator.getAddress();

    // Deploy the factory contract
    const BasedSeaCollectionFactoryFactory = await ethers.getContractFactory(
      "BasedSeaCollectionFactory",
      owner
    );

    factory = (await upgrades.deployProxy(
      BasedSeaCollectionFactoryFactory,
      [creationFee, ownerAddress],
      { initializer: "initialize", kind: "uups" }
    )) as unknown as BasedSeaCollectionFactory;

    await factory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct creation fee", async function () {
      expect(await factory.creationFee()).to.equal(creationFee);
    });

    it("Should set the correct fee recipient", async function () {
      expect(await factory.feeRecipient()).to.equal(ownerAddress);
    });

    it("Should set the correct owner", async function () {
      expect(await factory.owner()).to.equal(ownerAddress);
    });
  });

  describe("Collection Creation", function () {
    const collectionName = "Test Collection";
    const collectionSymbol = "TEST";
    const baseURI = "ipfs://baseuri/";
    const unrevealedURI = "ipfs://unrevealed";
    const contractURI = "ipfs://contracturi";
    const mintPrice = ethers.parseEther("0.05");
    const maxSupply = 1000;
    const maxTokensPerWallet = 3;
    const royaltyFee = 500; // 5%

    it("Should create a collection when the correct fee is paid", async function () {
      const tx = await factory.connect(creator).createCollection(
        collectionName,
        collectionSymbol,
        baseURI,
        unrevealedURI,
        contractURI,
        mintPrice,
        maxSupply,
        maxTokensPerWallet,
        royaltyFee,
        true, // mintingEnabled
        false, // startRevealed
        { value: creationFee }
      );

      const receipt = await tx.wait();

      // Find the CollectionCreated event
      const event = receipt!.logs.find(
        (e: any) => e.fragment && e.fragment.name === "CollectionCreated"
      );

      expect(event).to.not.be.undefined;
      const collectionAddress = (event as any).args[1];

      // Verify collection details
      const collection = (await ethers.getContractAt(
        "BasedSeaSequentialNFTCollection",
        collectionAddress
      )) as BasedSeaSequentialNFTCollection;

      expect(await collection.name()).to.equal(collectionName);
      expect(await collection.symbol()).to.equal(collectionSymbol);
      expect(await collection.baseURI()).to.equal(baseURI);
      expect(await collection.unrevealedURI()).to.equal(unrevealedURI);
      expect(await collection.contractURI()).to.equal(contractURI);
      expect(await collection.mintPrice()).to.equal(mintPrice);
      expect(await collection.MAX_SUPPLY()).to.equal(maxSupply);
      expect(await collection.maxTokensPerWallet()).to.equal(
        maxTokensPerWallet
      );

      // Verify collection ownership
      expect(await collection.owner()).to.equal(creatorAddress);

      // Verify factory records
      expect(await factory.getCollectionCount()).to.equal(1);
      expect(await factory.collectionCreator(collectionAddress)).to.equal(
        creatorAddress
      );
    });

    it("Should revert when insufficient fee is paid", async function () {
      const insufficientFee = ethers.parseEther("0.005");
      await expect(
        factory.connect(creator).createCollection(
          collectionName,
          collectionSymbol,
          baseURI,
          unrevealedURI,
          contractURI,
          mintPrice,
          maxSupply,
          maxTokensPerWallet,
          royaltyFee,
          true, // mintingEnabled
          false, // startRevealed
          { value: insufficientFee }
        )
      ).to.be.revertedWith("Insufficient creation fee");
    });

    it("Should allow owner to update the creation fee", async function () {
      const newFee = ethers.parseEther("0.02");
      await expect(factory.connect(owner).setCreationFee(newFee))
        .to.emit(factory, "CreationFeeUpdated")
        .withArgs(newFee);

      expect(await factory.creationFee()).to.equal(newFee);
    });

    it("Should allow owner to update the fee recipient", async function () {
      const newRecipient = await (await ethers.getSigners())[2].getAddress();
      await expect(factory.connect(owner).setFeeRecipient(newRecipient))
        .to.emit(factory, "FeeRecipientUpdated")
        .withArgs(newRecipient);

      expect(await factory.feeRecipient()).to.equal(newRecipient);
    });

    it("Should not allow non-owner to update configuration", async function () {
      await expect(
        factory.connect(creator).setCreationFee(ethers.parseEther("0.02"))
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });

  describe("Collection Management", function () {
    beforeEach(async function () {
      // Create a collection
      await factory.connect(creator).createCollection(
        "Test Collection",
        "TEST",
        "ipfs://baseuri/",
        "ipfs://unrevealed",
        "ipfs://contracturi",
        ethers.parseEther("0.05"),
        1000,
        3,
        500, // 5%
        true, // mintingEnabled
        false, // startRevealed
        { value: creationFee }
      );
    });

    it("Should correctly track all created collections", async function () {
      expect(await factory.getCollectionCount()).to.equal(1);

      // Create another collection
      await factory
        .connect(creator)
        .createCollection(
          "Test Collection 2",
          "TEST2",
          "ipfs://baseuri2/",
          "ipfs://unrevealed2",
          "ipfs://contracturi2",
          ethers.parseEther("0.06"),
          1000,
          3,
          500,
          true,
          false,
          { value: creationFee }
        );

      expect(await factory.getCollectionCount()).to.equal(2);

      // Get all collections
      const collections = await factory.getCollections();
      expect(collections.length).to.equal(2);

      // Verify each collection has correct creator
      for (const collection of collections) {
        expect(await factory.collectionCreator(collection)).to.equal(
          creatorAddress
        );
      }
    });
  });
});
