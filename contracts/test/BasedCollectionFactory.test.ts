// contracts/test/BasedCollectionFactory.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { BasedCollectionFactory, BasedNFTCollection } from "../typechain-types";

describe("BasedCollectionFactory", function () {
  let factory: BasedCollectionFactory;
  let owner: any;
  let addr1: any;
  let addr2: any;

  const creationFee = ethers.parseEther("0.001"); // 0.001 ETH

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy factory
    const BasedCollectionFactoryFactory = await ethers.getContractFactory(
      "BasedCollectionFactory"
    );
    factory = await BasedCollectionFactoryFactory.deploy(
      creationFee,
      owner.address
    );
  });

  describe("Deployment", function () {
    it("Should set the correct creation fee", async function () {
      expect(await factory.creationFee()).to.equal(creationFee);
    });

    it("Should set the correct fee recipient", async function () {
      expect(await factory.feeRecipient()).to.equal(owner.address);
    });

    it("Should set the correct owner", async function () {
      expect(await factory.owner()).to.equal(owner.address);
    });
  });

  describe("Collection Creation", function () {
    const collectionName = "Based Collection";
    const collectionSymbol = "BASED";
    const collectionURI = "ipfs://QmCollectionMetadata";
    const mintPrice = ethers.parseEther("0.1"); // 0.1 ETH
    const maxSupply = 100;
    const royaltyFee = 250; // 2.5%

    it("Should create a new collection with correct parameters", async function () {
      // Create a collection
      const tx = await factory
        .connect(addr1)
        .createCollection(
          collectionName,
          collectionSymbol,
          collectionURI,
          mintPrice,
          maxSupply,
          royaltyFee,
          true,
          { value: creationFee }
        );

      // Get transaction receipt
      const receipt = await tx.wait();

      // Check event was emitted
      const event = receipt!.logs.find(
        (log) =>
          log.topics[0] ===
          ethers.id("CollectionCreated(address,address,string,string)")
      );
      expect(event).to.not.be.undefined;

      // Parse the event
      const parsedEvent = factory.interface.parseLog({
        topics: event!.topics,
        data: event!.data,
      });

      // Get the collection address from the event
      const collectionAddress = parsedEvent!.args.collection;

      // Check collection was recorded
      expect(await factory.collectionCreator(collectionAddress)).to.equal(
        addr1.address
      );
      expect(await factory.getCollectionCount()).to.equal(1);

      const collections = await factory.getCollections();
      expect(collections.length).to.equal(1);
      expect(collections[0]).to.equal(collectionAddress);

      // Check the collection properties
      const BasedNFTCollection = await ethers.getContractFactory(
        "BasedNFTCollection"
      );
      const collection = BasedNFTCollection.attach(
        collectionAddress
      ) as BasedNFTCollection;

      expect(await collection.name()).to.equal(collectionName);
      expect(await collection.symbol()).to.equal(collectionSymbol);
      expect(await collection.collectionURI()).to.equal(collectionURI);
      expect(await collection.mintPrice()).to.equal(mintPrice);
      expect(await collection.maxSupply()).to.equal(maxSupply);
      expect(await collection.royaltyFee()).to.equal(royaltyFee);
      expect(await collection.owner()).to.equal(addr1.address); // Creator should be the owner
    });

    it("Should not allow creating a collection without paying the fee", async function () {
      const lowFee = ethers.parseEther("0.0005"); // Lower than required fee

      await expect(
        factory
          .connect(addr1)
          .createCollection(
            collectionName,
            collectionSymbol,
            collectionURI,
            mintPrice,
            maxSupply,
            royaltyFee,
            true,
            { value: lowFee }
          )
      ).to.be.revertedWith("Insufficient creation fee");
    });

    it("Should transfer the creation fee to the fee recipient", async function () {
      // Get initial balance
      const initialBalance = await ethers.provider.getBalance(owner.address);

      // Create a collection
      await factory
        .connect(addr1)
        .createCollection(
          collectionName,
          collectionSymbol,
          collectionURI,
          mintPrice,
          maxSupply,
          royaltyFee,
          true,
          { value: creationFee }
        );

      // Get final balance
      const finalBalance = await ethers.provider.getBalance(owner.address);

      // Owner should have received the fee
      expect(finalBalance).to.equal(initialBalance + creationFee);
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to update creation fee", async function () {
      const newFee = ethers.parseEther("0.02");

      await expect(factory.connect(owner).setCreationFee(newFee))
        .to.emit(factory, "CreationFeeUpdated")
        .withArgs(newFee);

      expect(await factory.creationFee()).to.equal(newFee);
    });

    it("Should allow owner to update fee recipient", async function () {
      await expect(factory.connect(owner).setFeeRecipient(addr2.address))
        .to.emit(factory, "FeeRecipientUpdated")
        .withArgs(addr2.address);

      expect(await factory.feeRecipient()).to.equal(addr2.address);
    });

    it("Should not allow non-owner to call owner functions", async function () {
      await expect(
        factory.connect(addr1).setCreationFee(ethers.parseEther("0.02"))
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      await expect(
        factory.connect(addr1).setFeeRecipient(addr2.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });
  });
});
