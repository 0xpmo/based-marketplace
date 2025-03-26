import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("BasedCollectionFactory V2 Upgrade", function () {
  // Using any type to avoid complex typing issues in tests
  let factory: any;
  let factoryV2: any;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let trustedCreator: HardhatEthersSigner;
  const CREATION_FEE = ethers.parseEther("0.001"); // 0.001 ETH
  const DISCOUNT_HALF_FEE = CREATION_FEE / 2n; // 0.0005 ETH (50% discount)

  beforeEach(async function () {
    // Get signers
    [owner, user, trustedCreator] = await ethers.getSigners();

    // Deploy the factory V1 as upgradeable
    const BasedCollectionFactory = await ethers.getContractFactory(
      "BasedCollectionFactory"
    );

    // Deploy proxy with V1 implementation
    factory = await upgrades.deployProxy(
      BasedCollectionFactory,
      [CREATION_FEE, owner.address],
      { initializer: "initialize" }
    );

    await factory.waitForDeployment();

    // Create a collection with V1 to test state preservation
    await factory
      .connect(user)
      .createCollection(
        "Test Collection",
        "TEST",
        "ipfs://QmBaseMetadata/",
        "ipfs://QmCollectionMetadata",
        ethers.parseEther("0.05"),
        100,
        500,
        true,
        { value: CREATION_FEE }
      );

    // Perform the upgrade to V2
    const BasedCollectionFactoryV2 = await ethers.getContractFactory(
      "BasedCollectionFactoryV2"
    );

    factoryV2 = await upgrades.upgradeProxy(
      await factory.getAddress(),
      BasedCollectionFactoryV2
    );

    await factoryV2.waitForDeployment();
  });

  it("should preserve existing state after upgrade", async function () {
    // Check that V1 state is preserved
    expect(await factoryV2.creationFee()).to.equal(CREATION_FEE);
    expect(await factoryV2.feeRecipient()).to.equal(owner.address);
    expect(await factoryV2.owner()).to.equal(owner.address);
    expect(await factoryV2.getCollectionCount()).to.equal(1n);
  });

  it("should have new V2 functionality", async function () {
    // V2 has a default discount percentage of 50% (5000 basis points)
    await factoryV2.connect(owner).setDiscountPercentage(5000);
    expect(await factoryV2.discountPercentage()).to.equal(5000n); // 50%
    expect(await factoryV2.trustedCreator(trustedCreator.address)).to.be.false;
  });

  it("should allow setting trusted creators", async function () {
    // Make sure discount percentage is set to 50% (5000 basis points)
    await factoryV2.connect(owner).setDiscountPercentage(5000);

    // Set trusted creator
    await factoryV2
      .connect(owner)
      .setTrustedCreator(trustedCreator.address, true);
    expect(await factoryV2.trustedCreator(trustedCreator.address)).to.be.true;

    // Test discount calculation
    const discountedFee = await factoryV2.getCreationFeeForCreator(
      trustedCreator.address
    );
    expect(discountedFee).to.equal(DISCOUNT_HALF_FEE);
  });

  it("should allow updating discount percentage", async function () {
    // Update discount to 30%
    await factoryV2.connect(owner).setDiscountPercentage(3000);
    expect(await factoryV2.discountPercentage()).to.equal(3000n);

    // Set trusted creator for discount
    await factoryV2
      .connect(owner)
      .setTrustedCreator(trustedCreator.address, true);

    // Test discounted fee calculation with new percentage
    const discountedFee = await factoryV2.getCreationFeeForCreator(
      trustedCreator.address
    );
    const expectedDiscountedFee = (CREATION_FEE * 3000n) / 10000n; // 30% discount
    expect(discountedFee).to.equal(CREATION_FEE - expectedDiscountedFee);
  });

  it("should allow trusted creators to create collections with discounted fee", async function () {
    // Set discount to 50%
    await factoryV2.connect(owner).setDiscountPercentage(5000);

    // Set trusted creator
    await factoryV2
      .connect(owner)
      .setTrustedCreator(trustedCreator.address, true);

    // Calculate discounted fee
    const discountedFee = await factoryV2.getCreationFeeForCreator(
      trustedCreator.address
    );

    // Create a collection with discounted fee
    await factoryV2
      .connect(trustedCreator)
      .createCollection(
        "Trusted Collection",
        "TRUST",
        "ipfs://QmBaseMetadata/",
        "ipfs://QmCollectionMetadata",
        ethers.parseEther("0.05"),
        100,
        500,
        true,
        { value: discountedFee }
      );

    // Verify the collection was created
    expect(await factoryV2.getCollectionCount()).to.equal(2n);
  });

  it("should verify collections", async function () {
    // Get the first collection address
    const collections = await factoryV2.getCollections();
    const collectionAddress = collections[0];

    // Verify it
    await factoryV2
      .connect(owner)
      .setCollectionVerification(collectionAddress, true);

    // Check verification status
    expect(await factoryV2.verifiedCollection(collectionAddress)).to.be.true;
  });
});
