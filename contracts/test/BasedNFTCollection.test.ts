// contracts/test/BasedNFTCollection.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { BasedNFTCollection } from "../typechain-types";

describe("BasedNFTCollection", function () {
  let nftCollection: BasedNFTCollection;
  let owner: any;
  let addr1: any;
  let addr2: any;

  const collectionName = "Based Collection";
  const collectionSymbol = "BASED";
  const collectionURI = "ipfs://QmCollectionMetadata";
  const mintPrice = ethers.parseEther("0.1"); // 0.1 ETH
  const maxSupply = 100;
  const royaltyFee = 250; // 2.5%

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy collection
    const BasedNFTCollectionFactory = await ethers.getContractFactory(
      "BasedNFTCollection"
    );
    nftCollection = await BasedNFTCollectionFactory.deploy(
      collectionName,
      collectionSymbol,
      collectionURI,
      mintPrice,
      maxSupply,
      royaltyFee,
      true,
      owner.address
    );
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await nftCollection.name()).to.equal(collectionName);
      expect(await nftCollection.symbol()).to.equal(collectionSymbol);
    });

    it("Should set the correct collection URI", async function () {
      expect(await nftCollection.collectionURI()).to.equal(collectionURI);
    });

    it("Should set the correct mint price", async function () {
      expect(await nftCollection.mintPrice()).to.equal(mintPrice);
    });

    it("Should set the correct max supply", async function () {
      expect(await nftCollection.maxSupply()).to.equal(maxSupply);
    });

    it("Should set the correct royalty fee", async function () {
      expect(await nftCollection.royaltyFee()).to.equal(royaltyFee);
    });

    it("Should set the correct owner", async function () {
      expect(await nftCollection.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    const tokenURI = "ipfs://QmTokenMetadata";

    it("Should allow minting with correct payment", async function () {
      // Mint an NFT
      await expect(
        nftCollection
          .connect(addr1)
          .mint(addr1.address, tokenURI, { value: mintPrice })
      )
        .to.emit(nftCollection, "NFTMinted")
        .withArgs(addr1.address, 1, tokenURI);

      // Check token owner
      expect(await nftCollection.ownerOf(1)).to.equal(addr1.address);

      // Check token URI
      expect(await nftCollection.tokenURI(1)).to.equal(tokenURI);

      // Check total minted
      expect(await nftCollection.totalMinted()).to.equal(1);
    });

    it("Should not allow minting with insufficient payment", async function () {
      const lowPrice = ethers.parseEther("0.05"); // Lower than mint price

      await expect(
        nftCollection
          .connect(addr1)
          .mint(addr1.address, tokenURI, { value: lowPrice })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should not allow minting when disabled", async function () {
      // Disable minting
      await nftCollection.connect(owner).setMintingEnabled(false);

      await expect(
        nftCollection
          .connect(addr1)
          .mint(addr1.address, tokenURI, { value: mintPrice })
      ).to.be.revertedWith("Minting is disabled");
    });

    it("Should not allow minting beyond max supply", async function () {
      // Deploy a collection with max supply of 1
      const BasedNFTCollectionFactory = await ethers.getContractFactory(
        "BasedNFTCollection"
      );
      const smallCollection = await BasedNFTCollectionFactory.deploy(
        collectionName,
        collectionSymbol,
        collectionURI,
        mintPrice,
        1, // Max supply of 1
        royaltyFee,
        true,
        owner.address
      );

      // Mint the only NFT
      await smallCollection
        .connect(addr1)
        .mint(addr1.address, tokenURI, { value: mintPrice });

      // Try to mint another one
      await expect(
        smallCollection
          .connect(addr2)
          .mint(addr2.address, tokenURI, { value: mintPrice })
      ).to.be.revertedWith("Max supply reached");
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to update collection URI", async function () {
      const newURI = "ipfs://QmNewCollectionMetadata";

      await expect(nftCollection.connect(owner).setCollectionURI(newURI))
        .to.emit(nftCollection, "CollectionURIUpdated")
        .withArgs(newURI);

      expect(await nftCollection.collectionURI()).to.equal(newURI);
    });

    it("Should allow owner to update mint price", async function () {
      const newPrice = ethers.parseEther("0.2");

      await expect(nftCollection.connect(owner).setMintPrice(newPrice))
        .to.emit(nftCollection, "MintPriceUpdated")
        .withArgs(newPrice);

      expect(await nftCollection.mintPrice()).to.equal(newPrice);
    });

    it("Should allow owner to enable/disable minting", async function () {
      await expect(nftCollection.connect(owner).setMintingEnabled(false))
        .to.emit(nftCollection, "MintingStatusUpdated")
        .withArgs(false);

      expect(await nftCollection.mintingEnabled()).to.equal(false);

      await expect(nftCollection.connect(owner).setMintingEnabled(true))
        .to.emit(nftCollection, "MintingStatusUpdated")
        .withArgs(true);

      expect(await nftCollection.mintingEnabled()).to.equal(true);
    });

    it("Should allow owner to withdraw funds", async function () {
      // Mint an NFT to add funds to the contract
      await nftCollection
        .connect(addr1)
        .mint(addr1.address, "ipfs://QmTokenMetadata", { value: mintPrice });

      // Get initial balances
      const initialContractBalance = await ethers.provider.getBalance(
        await nftCollection.getAddress()
      );
      const initialOwnerBalance = await ethers.provider.getBalance(
        owner.address
      );

      // Withdraw funds
      const tx = await nftCollection.connect(owner).withdraw();
      const receipt = await tx.wait();

      // Calculate gas cost
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      // Get final balances
      const finalContractBalance = await ethers.provider.getBalance(
        await nftCollection.getAddress()
      );
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);

      // Contract balance should be 0
      expect(finalContractBalance).to.equal(0);

      // Owner should have received the funds (minus gas cost)
      expect(finalOwnerBalance).to.equal(
        initialOwnerBalance + initialContractBalance - gasCost
      );
    });

    it("Should not allow non-owner to call owner functions", async function () {
      await expect(
        nftCollection.connect(addr1).setCollectionURI("ipfs://QmNewURI")
      ).to.be.revertedWithCustomError(
        nftCollection,
        "OwnableUnauthorizedAccount"
      );

      await expect(
        nftCollection.connect(addr1).setMintPrice(ethers.parseEther("0.2"))
      ).to.be.revertedWithCustomError(
        nftCollection,
        "OwnableUnauthorizedAccount"
      );

      await expect(
        nftCollection.connect(addr1).setMintingEnabled(false)
      ).to.be.revertedWithCustomError(
        nftCollection,
        "OwnableUnauthorizedAccount"
      );

      await expect(
        nftCollection.connect(addr1).withdraw()
      ).to.be.revertedWithCustomError(
        nftCollection,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});
