// contracts/test/PepeMarketplace.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { PepeMarketplace, PepeNFTCollection } from "../typechain-types";

describe("PepeMarketplace", function () {
  let marketplace: PepeMarketplace;
  let nftCollection: PepeNFTCollection;
  let owner: any;
  let seller: any;
  let buyer: any;
  let feeRecipient: any;

  const marketFee = 250; // 2.5%
  const collectionName = "Pepe Collection";
  const collectionSymbol = "PEPE";
  const collectionURI = "ipfs://QmCollectionMetadata";
  const mintPrice = ethers.parseEther("0.1"); // 0.1 ETH
  const maxSupply = 100;
  const royaltyFee = 250; // 2.5%
  const tokenURI = "ipfs://QmTokenMetadata";
  const listingPrice = ethers.parseEther("0.2"); // 0.2 ETH

  beforeEach(async function () {
    // Get signers
    [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

    // Deploy marketplace
    const PepeMarketplaceFactory = await ethers.getContractFactory(
      "PepeMarketplace"
    );
    marketplace = await PepeMarketplaceFactory.deploy(marketFee, owner.address);

    // Deploy NFT collection
    const PepeNFTCollectionFactory = await ethers.getContractFactory(
      "PepeNFTCollection"
    );
    nftCollection = await PepeNFTCollectionFactory.deploy(
      collectionName,
      collectionSymbol,
      collectionURI,
      mintPrice,
      maxSupply,
      royaltyFee,
      seller.address // Seller is the owner of the collection
    );

    // Mint an NFT for the seller
    await nftCollection
      .connect(seller)
      .mint(seller.address, tokenURI, { value: mintPrice });

    // Approve marketplace to transfer the NFT
    await nftCollection
      .connect(seller)
      .setApprovalForAll(await marketplace.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the correct market fee", async function () {
      expect(await marketplace.marketFee()).to.equal(marketFee);
    });

    it("Should set the correct owner", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
    });
  });

  describe("Listing Items", function () {
    it("Should allow listing an NFT", async function () {
      await expect(
        marketplace
          .connect(seller)
          .listItem(await nftCollection.getAddress(), 1, listingPrice)
      )
        .to.emit(marketplace, "ItemListed")
        .withArgs(
          seller.address,
          await nftCollection.getAddress(),
          1,
          listingPrice
        );

      const listing = await marketplace.getListing(
        await nftCollection.getAddress(),
        1
      );
      expect(listing.seller).to.equal(seller.address);
      expect(listing.nftContract).to.equal(await nftCollection.getAddress());
      expect(listing.tokenId).to.equal(1);
      expect(listing.price).to.equal(listingPrice);
      expect(listing.active).to.equal(true);

      expect(
        await marketplace.isListed(await nftCollection.getAddress(), 1)
      ).to.equal(true);
    });

    it("Should not allow listing an NFT you don't own", async function () {
      await expect(
        marketplace
          .connect(buyer)
          .listItem(await nftCollection.getAddress(), 1, listingPrice)
      ).to.be.revertedWith("Not the owner");
    });

    it("Should not allow listing an NFT without marketplace approval", async function () {
      // Revoke approval
      await nftCollection
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), false);

      await expect(
        marketplace
          .connect(seller)
          .listItem(await nftCollection.getAddress(), 1, listingPrice)
      ).to.be.revertedWith("Marketplace not approved");
    });

    it("Should not allow listing with zero price", async function () {
      await expect(
        marketplace
          .connect(seller)
          .listItem(await nftCollection.getAddress(), 1, 0)
      ).to.be.revertedWith("Price must be greater than zero");
    });
  });

  describe("Buying Items", function () {
    beforeEach(async function () {
      // List the NFT
      await marketplace
        .connect(seller)
        .listItem(await nftCollection.getAddress(), 1, listingPrice);
    });

    it("Should allow buying a listed NFT", async function () {
      await expect(
        marketplace
          .connect(buyer)
          .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice })
      )
        .to.emit(marketplace, "ItemSold")
        .withArgs(
          seller.address,
          buyer.address,
          await nftCollection.getAddress(),
          1,
          listingPrice
        );

      // Check NFT ownership
      expect(await nftCollection.ownerOf(1)).to.equal(buyer.address);

      // Check listing is no longer active
      expect(
        await marketplace.isListed(await nftCollection.getAddress(), 1)
      ).to.equal(false);
      const listing = await marketplace.getListing(
        await nftCollection.getAddress(),
        1
      );
      expect(listing.active).to.equal(false);
    });

    it("Should distribute funds correctly when buying an NFT", async function () {
      // Calculate expected amounts
      const marketFeeAmount =
        (listingPrice * BigInt(marketFee)) / BigInt(10000);
      const royaltyAmount = (listingPrice * BigInt(royaltyFee)) / BigInt(10000);
      const sellerAmount = listingPrice - marketFeeAmount - royaltyAmount;

      // Get initial balances
      const initialSellerBalance = await ethers.provider.getBalance(
        seller.address
      );
      const initialOwnerBalance = await ethers.provider.getBalance(
        owner.address
      );
      const initialBuyerBalance = await ethers.provider.getBalance(
        buyer.address
      );

      // Buy the NFT
      const tx = await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice });
      const receipt = await tx.wait();

      // Calculate gas cost
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      // Get final balances
      const finalSellerBalance = await ethers.provider.getBalance(
        seller.address
      );
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      const finalBuyerBalance = await ethers.provider.getBalance(buyer.address);

      // Check balances
      // Seller should have received their share
      expect(finalSellerBalance).to.equal(initialSellerBalance + sellerAmount);

      // Owner (as marketplace fee recipient) should have received the market fee
      expect(finalOwnerBalance).to.equal(initialOwnerBalance + marketFeeAmount);

      // Buyer should have paid the price plus gas
      expect(finalBuyerBalance).to.equal(
        initialBuyerBalance - listingPrice - gasCost
      );
    });

    it("Should handle royalties correctly", async function () {
      // The royalty recipient is the collection owner (seller in this case)
      // So the seller gets their share + royalty

      // Calculate expected amounts
      const marketFeeAmount =
        (listingPrice * BigInt(marketFee)) / BigInt(10000);
      const royaltyAmount = (listingPrice * BigInt(royaltyFee)) / BigInt(10000);
      const sellerAmount =
        listingPrice - marketFeeAmount - royaltyAmount + royaltyAmount; // Seller gets royalty too

      // Get initial balances
      const initialSellerBalance = await ethers.provider.getBalance(
        seller.address
      );

      // Buy the NFT
      await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice });

      // Get final balance
      const finalSellerBalance = await ethers.provider.getBalance(
        seller.address
      );

      // Check balance
      expect(finalSellerBalance).to.equal(initialSellerBalance + sellerAmount);
    });

    it("Should not allow buying an unlisted NFT", async function () {
      // Cancel the listing
      await marketplace
        .connect(seller)
        .cancelListing(await nftCollection.getAddress(), 1);

      await expect(
        marketplace
          .connect(buyer)
          .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice })
      ).to.be.revertedWith("Item not active");
    });

    it("Should not allow buying with insufficient funds", async function () {
      const lowPrice = ethers.parseEther("0.1"); // Lower than listing price

      await expect(
        marketplace
          .connect(buyer)
          .buyItem(await nftCollection.getAddress(), 1, { value: lowPrice })
      ).to.be.revertedWith("Insufficient funds");
    });

    it("Should refund excess payment", async function () {
      const excessPrice = ethers.parseEther("0.3"); // Higher than listing price

      // Get initial balance
      const initialBuyerBalance = await ethers.provider.getBalance(
        buyer.address
      );

      // Buy with excess payment
      const tx = await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: excessPrice });
      const receipt = await tx.wait();

      // Calculate gas cost
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      // Get final balance
      const finalBuyerBalance = await ethers.provider.getBalance(buyer.address);

      // Buyer should have paid only the listing price plus gas
      expect(finalBuyerBalance).to.equal(
        initialBuyerBalance - listingPrice - gasCost
      );
    });
  });

  describe("Canceling Listings", function () {
    beforeEach(async function () {
      // List the NFT
      await marketplace
        .connect(seller)
        .listItem(await nftCollection.getAddress(), 1, listingPrice);
    });

    it("Should allow seller to cancel their listing", async function () {
      await expect(
        marketplace
          .connect(seller)
          .cancelListing(await nftCollection.getAddress(), 1)
      )
        .to.emit(marketplace, "ItemCanceled")
        .withArgs(seller.address, await nftCollection.getAddress(), 1);

      expect(
        await marketplace.isListed(await nftCollection.getAddress(), 1)
      ).to.equal(false);
      const listing = await marketplace.getListing(
        await nftCollection.getAddress(),
        1
      );
      expect(listing.active).to.equal(false);
    });

    it("Should not allow non-seller to cancel a listing", async function () {
      await expect(
        marketplace
          .connect(buyer)
          .cancelListing(await nftCollection.getAddress(), 1)
      ).to.be.revertedWith("Not the seller");
    });

    it("Should not allow canceling an inactive listing", async function () {
      // Cancel the listing
      await marketplace
        .connect(seller)
        .cancelListing(await nftCollection.getAddress(), 1);

      await expect(
        marketplace
          .connect(seller)
          .cancelListing(await nftCollection.getAddress(), 1)
      ).to.be.revertedWith("Listing not active");
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to update market fee", async function () {
      const newFee = 300; // 3%

      await expect(marketplace.connect(owner).setMarketFee(newFee))
        .to.emit(marketplace, "MarketFeeUpdated")
        .withArgs(newFee);

      expect(await marketplace.marketFee()).to.equal(newFee);
    });

    it("Should not allow setting a fee that's too high", async function () {
      const highFee = 1100; // 11%, above the 10% limit

      await expect(
        marketplace.connect(owner).setMarketFee(highFee)
      ).to.be.revertedWith("Fee too high");
    });

    it("Should not allow non-owner to call owner functions", async function () {
      await expect(
        marketplace.connect(seller).setMarketFee(300)
      ).to.be.revertedWithCustomError(
        marketplace,
        "OwnableUnauthorizedAccount"
      );
    });
  });
});
