import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("BasedCollectionFactory (Upgradeable)", function () {
  // Using any type to avoid complex typing issues in tests
  let factory: any;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  const CREATION_FEE = ethers.parseEther("0.001"); // 0.001 ETH

  beforeEach(async function () {
    // Get signers
    [owner, user] = await ethers.getSigners();

    // Deploy the factory as upgradeable
    const BasedCollectionFactory = await ethers.getContractFactory(
      "BasedCollectionFactory"
    );

    factory = await upgrades.deployProxy(
      BasedCollectionFactory,
      [CREATION_FEE, owner.address],
      { initializer: "initialize" }
    );

    await factory.waitForDeployment();
  });

  it("should initialize with correct values", async function () {
    expect(await factory.creationFee()).to.equal(CREATION_FEE);
    expect(await factory.feeRecipient()).to.equal(owner.address);
    expect(await factory.owner()).to.equal(owner.address);
  });

  it("should create a new collection", async function () {
    const name = "Test Collection";
    const symbol = "TEST";
    const baseURI = "ipfs://QmBaseMetadata/";
    const contractURI = "ipfs://QmCollectionMetadata";
    const mintPrice = ethers.parseEther("0.05");
    const maxSupply = 100;
    const royaltyFee = 500; // 5%
    const mintingEnabled = true;

    // Create a collection
    const tx = await factory
      .connect(user)
      .createCollection(
        name,
        symbol,
        baseURI,
        contractURI,
        mintPrice,
        maxSupply,
        royaltyFee,
        mintingEnabled,
        { value: CREATION_FEE }
      );

    const receipt = await tx.wait();

    // Get the event
    const event = receipt?.logs.find(
      (log: any) => log.fragment?.name === "CollectionCreated"
    );

    expect(event).to.not.be.undefined;

    // Verify that collection was created and recorded
    expect(await factory.getCollectionCount()).to.equal(1n);

    // Get the collection address from the event
    const collectionAddress = event?.args?.[1];

    // Check the collection creator mapping
    expect(await factory.collectionCreator(collectionAddress)).to.equal(
      user.address
    );
  });

  it("should allow owner to update the creation fee", async function () {
    const newFee = ethers.parseEther("0.002");
    await factory.connect(owner).setCreationFee(newFee);
    expect(await factory.creationFee()).to.equal(newFee);
  });

  it("should allow owner to update the fee recipient", async function () {
    await factory.connect(owner).setFeeRecipient(user.address);
    expect(await factory.feeRecipient()).to.equal(user.address);
  });

  it("should revert if creation fee is insufficient", async function () {
    const insufficientFee = ethers.parseEther("0.0005");

    await expect(
      factory
        .connect(user)
        .createCollection(
          "Test",
          "TEST",
          "ipfs://QmBaseMetadata/",
          "ipfs://QmCollectionMetadata",
          ethers.parseEther("0.05"),
          100,
          500,
          true,
          { value: insufficientFee }
        )
    ).to.be.revertedWith("Insufficient creation fee");
  });

  // Upgrade test
  it("should be upgradeable", async function () {
    // Deploy the upgraded version (same contract in this test)
    const BasedCollectionFactoryV2 = await ethers.getContractFactory(
      "BasedCollectionFactory"
    );
    const upgraded = await upgrades.upgradeProxy(
      await factory.getAddress(),
      BasedCollectionFactoryV2
    );

    // Check that storage values are maintained
    expect(await upgraded.creationFee()).to.equal(CREATION_FEE);
    expect(await upgraded.feeRecipient()).to.equal(owner.address);
    expect(await upgraded.owner()).to.equal(owner.address);

    // Current contract doesn't have new functionality, but in a real upgrade you would test new features here
  });
});
