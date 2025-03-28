// contracts/test/BasedMarketplace.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  BasedMarketplace,
  BasedMarketplaceStorage,
  BasedNFTCollection,
} from "../typechain-types";

describe("BasedMarketplace", function () {
  let marketplace: BasedMarketplace;
  let marketplaceStorage: BasedMarketplaceStorage;
  let nftCollection: BasedNFTCollection;
  let owner: any;
  let seller: any;
  let buyer: any;
  let feeRecipient: any;

  const marketFee = 250; // 2.5%
  const collectionName = "Based Collection";
  const collectionSymbol = "BASED";
  const baseURI = "ipfs://QmBaseMetadata/";
  const contractURI = "ipfs://QmCollectionMetadata";
  const mintPrice = ethers.parseEther("0.1"); // 0.1 ETH
  const maxSupply = 100;
  const royaltyFee = 250; // 2.5%
  const tokenURI = "ipfs://QmTokenMetadata";
  const listingPrice = ethers.parseEther("0.2"); // 0.2 ETH

  beforeEach(async function () {
    // Get signers
    [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

    // Deploy storage contract as upgradeable
    const BasedMarketplaceStorageFactory = await ethers.getContractFactory(
      "BasedMarketplaceStorage"
    );
    marketplaceStorage = (await upgrades.deployProxy(
      BasedMarketplaceStorageFactory,
      [],
      { initializer: "initialize", kind: "uups" }
    )) as unknown as BasedMarketplaceStorage;

    await marketplaceStorage.waitForDeployment();

    // Deploy marketplace as upgradeable
    const BasedMarketplaceFactory = await ethers.getContractFactory(
      "BasedMarketplace"
    );
    marketplace = (await upgrades.deployProxy(
      BasedMarketplaceFactory,
      [await marketplaceStorage.getAddress()],
      { initializer: "initialize", kind: "uups" }
    )) as unknown as BasedMarketplace;

    await marketplace.waitForDeployment();

    // Transfer ownership of storage to marketplace
    await marketplaceStorage.transferOwnership(await marketplace.getAddress());

    // Deploy NFT collection
    const BasedNFTCollectionFactory = await ethers.getContractFactory(
      "BasedNFTCollection"
    );
    nftCollection = await BasedNFTCollectionFactory.deploy(
      collectionName,
      collectionSymbol,
      baseURI,
      contractURI,
      mintPrice,
      maxSupply,
      royaltyFee,
      true, // Enable minting
      seller.address // Seller is the owner of the collection
    );

    // Mint an NFT for the seller
    await nftCollection
      .connect(seller)
      .mint(seller.address, { value: mintPrice });

    // Approve marketplace to transfer the NFT
    await nftCollection
      .connect(seller)
      .setApprovalForAll(await marketplace.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the correct market fee", async function () {
      expect(await marketplaceStorage.marketFee()).to.equal(marketFee);
    });

    it("Should set the correct owner of marketplace", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
    });

    it("Should set the correct owner of storage", async function () {
      expect(await marketplaceStorage.owner()).to.equal(
        await marketplace.getAddress()
      );
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
          listingPrice,
          false, // not private
          ethers.ZeroAddress // no allowed buyer
        );

      const [
        listingSeller,
        listingNftContract,
        listingTokenId,
        price,
        listingActive,
        listingIsPrivate,
        listingAllowedBuyer,
      ] = await marketplace.getListing(await nftCollection.getAddress(), 1);

      expect(listingSeller).to.equal(seller.address);
      expect(listingNftContract).to.equal(await nftCollection.getAddress());
      expect(listingTokenId).to.equal(1);
      expect(price).to.equal(listingPrice);
      expect(listingActive).to.equal(true);
      expect(listingIsPrivate).to.equal(false);
      expect(listingAllowedBuyer).to.equal(ethers.ZeroAddress);

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

      const [
        listingSeller,
        listingNftContract,
        listingTokenId,
        price,
        listingActive,
      ] = await marketplace.getListing(await nftCollection.getAddress(), 1);

      expect(listingActive).to.equal(false);
    });

    it("Should distribute funds correctly when buying an NFT", async function () {
      // Calculate expected amounts
      const marketFeeAmount =
        (listingPrice * BigInt(marketFee)) / BigInt(10000);
      const royaltyAmount = (listingPrice * BigInt(royaltyFee)) / BigInt(10000);
      const expectedSellerAmount =
        listingPrice - marketFeeAmount - royaltyAmount;
      const expectedTotalToSeller = expectedSellerAmount + royaltyAmount; // Seller also gets royalty as creator

      console.log("\n----- TEST CONFIGURATION -----");
      console.log(`Listing Price: ${ethers.formatEther(listingPrice)} ETH`);
      console.log(
        `Market Fee: ${marketFee} basis points (${marketFee / 100}%)`
      );
      console.log(
        `Royalty Fee: ${royaltyFee} basis points (${royaltyFee / 100}%)`
      );
      console.log(
        `Market Fee Amount: ${ethers.formatEther(marketFeeAmount)} ETH`
      );
      console.log(`Royalty Amount: ${ethers.formatEther(royaltyAmount)} ETH`);
      console.log(
        `Expected Seller Amount (without royalty): ${ethers.formatEther(
          expectedSellerAmount
        )} ETH`
      );
      console.log(
        `Expected Total to Seller (with royalty): ${ethers.formatEther(
          expectedTotalToSeller
        )} ETH`
      );

      // Buy the NFT
      const tx = await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice });
      const receipt = await tx.wait();

      // Verify accumulated fees
      const accumulatedFees = await marketplace.getAccumulatedFees();
      expect(accumulatedFees).to.equal(marketFeeAmount);

      // Verify pending withdrawals for seller
      const sellerPendingWithdrawal = await marketplace.getPendingWithdrawal(
        seller.address
      );
      expect(sellerPendingWithdrawal).to.equal(expectedTotalToSeller);

      console.log("\n----- PENDING WITHDRAWALS -----");
      console.log(
        `Seller pending withdrawal: ${ethers.formatEther(
          sellerPendingWithdrawal
        )} ETH`
      );
      console.log(
        `Accumulated marketplace fees: ${ethers.formatEther(
          accumulatedFees
        )} ETH`
      );

      // Now test withdrawal
      const initialSellerBalance = await ethers.provider.getBalance(
        seller.address
      );

      const withdrawTx = await marketplace
        .connect(seller)
        .withdrawPendingFunds();
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawGasCost =
        withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

      const finalSellerBalance = await ethers.provider.getBalance(
        seller.address
      );

      console.log("\n----- AFTER WITHDRAWAL -----");
      console.log(
        `Seller balance change: ${ethers.formatEther(
          finalSellerBalance - initialSellerBalance
        )} ETH`
      );
      console.log(
        `Gas cost for withdrawal: ${ethers.formatEther(withdrawGasCost)} ETH`
      );

      // Verify seller received their funds (minus gas costs for the withdrawal transaction)
      expect(finalSellerBalance).to.be.closeTo(
        initialSellerBalance + sellerPendingWithdrawal - withdrawGasCost,
        ethers.parseEther("0.0001") // Small buffer
      );

      // Verify pending withdrawal is now zero
      expect(await marketplace.getPendingWithdrawal(seller.address)).to.equal(
        0
      );
    });

    // Add a new test for owner withdrawing fees
    it("Should allow owner to withdraw accumulated fees", async function () {
      // List and sell an NFT to generate fees
      await marketplace
        .connect(seller)
        .listItem(await nftCollection.getAddress(), 1, listingPrice);

      await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice });

      // Calculate market fee
      const marketFeeAmount =
        (listingPrice * BigInt(marketFee)) / BigInt(10000);

      // Verify accumulated fees
      expect(await marketplace.getAccumulatedFees()).to.equal(marketFeeAmount);

      // Owner withdraws fees
      await marketplace.connect(owner).withdrawAccumulatedFees();

      // Check owner's pending withdrawal
      const ownerPendingWithdrawal = await marketplace.getPendingWithdrawal(
        owner.address
      );
      expect(ownerPendingWithdrawal).to.equal(marketFeeAmount);

      // Check accumulated fees are reset
      expect(await marketplace.getAccumulatedFees()).to.equal(0);

      // Owner withdraws funds
      const initialOwnerBalance = await ethers.provider.getBalance(
        owner.address
      );

      const withdrawTx = await marketplace
        .connect(owner)
        .withdrawPendingFunds();
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawGasCost =
        withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);

      // Verify owner received the fees (minus gas costs)
      expect(finalOwnerBalance).to.be.closeTo(
        initialOwnerBalance + marketFeeAmount - withdrawGasCost,
        ethers.parseEther("0.0001") // Small buffer
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

      // Buy the NFT
      await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice });

      // Check pending withdrawal for seller
      const sellerPendingWithdrawal = await marketplace.getPendingWithdrawal(
        seller.address
      );
      expect(sellerPendingWithdrawal).to.equal(sellerAmount);

      // Withdraw and verify
      const initialSellerBalance = await ethers.provider.getBalance(
        seller.address
      );

      const withdrawTx = await marketplace
        .connect(seller)
        .withdrawPendingFunds();
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawGasCost =
        withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

      const finalSellerBalance = await ethers.provider.getBalance(
        seller.address
      );

      // Verify seller received their funds (minus gas costs for the withdrawal transaction)
      expect(finalSellerBalance).to.be.closeTo(
        initialSellerBalance + sellerPendingWithdrawal - withdrawGasCost,
        ethers.parseEther("0.0001") // Small buffer
      );
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

      const [
        listingSeller,
        listingNftContract,
        listingTokenId,
        price,
        listingActive,
      ] = await marketplace.getListing(await nftCollection.getAddress(), 1);

      expect(listingActive).to.equal(false);
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

  describe("Bidding with Pull Payment", function () {
    beforeEach(async function () {
      // List the NFT
      await marketplace
        .connect(seller)
        .listItem(await nftCollection.getAddress(), 1, listingPrice);
    });

    it("Should handle bid refunds correctly with pull payment", async function () {
      const bidAmount1 = ethers.parseEther("0.1");
      const bidAmount2 = ethers.parseEther("0.15");

      // Place first bid
      await marketplace
        .connect(buyer)
        .placeBid(await nftCollection.getAddress(), 1, { value: bidAmount1 });

      // Get another bidder to outbid
      const [_, __, ___, bidder2] = await ethers.getSigners();

      // Place higher bid
      await marketplace
        .connect(bidder2)
        .placeBid(await nftCollection.getAddress(), 1, { value: bidAmount2 });

      // Check buyer's pending withdrawal
      const buyerPendingWithdrawal = await marketplace.getPendingWithdrawal(
        buyer.address
      );
      expect(buyerPendingWithdrawal).to.equal(bidAmount1);

      // Withdraw funds and verify
      const initialBuyerBalance = await ethers.provider.getBalance(
        buyer.address
      );

      const withdrawTx = await marketplace
        .connect(buyer)
        .withdrawPendingFunds();
      const withdrawReceipt = await withdrawTx.wait();
      const withdrawGasCost =
        withdrawReceipt!.gasUsed * withdrawReceipt!.gasPrice;

      const finalBuyerBalance = await ethers.provider.getBalance(buyer.address);

      // Verify buyer received their bid refund (minus gas costs)
      expect(finalBuyerBalance).to.be.closeTo(
        initialBuyerBalance + bidAmount1 - withdrawGasCost,
        ethers.parseEther("0.0001") // Small buffer
      );
    });

    it("Should handle accepted bids correctly with pull payment", async function () {
      const bidAmount = ethers.parseEther("0.15");

      // Place bid
      await marketplace
        .connect(buyer)
        .placeBid(await nftCollection.getAddress(), 1, { value: bidAmount });

      // Accept bid
      await marketplace
        .connect(seller)
        .acceptBid(await nftCollection.getAddress(), 1);

      // Calculate expected amounts
      const marketFeeAmount = (bidAmount * BigInt(marketFee)) / BigInt(10000);
      const royaltyAmount = (bidAmount * BigInt(royaltyFee)) / BigInt(10000);
      const expectedSellerAmount =
        bidAmount - marketFeeAmount - royaltyAmount + royaltyAmount; // Seller gets royalty too

      // Check seller's pending withdrawal
      const sellerPendingWithdrawal = await marketplace.getPendingWithdrawal(
        seller.address
      );
      expect(sellerPendingWithdrawal).to.equal(expectedSellerAmount);

      // Verify ownership transferred
      expect(await nftCollection.ownerOf(1)).to.equal(buyer.address);
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to update market fee", async function () {
      const newFee = 300; // 3%

      await expect(marketplace.connect(owner).setMarketFee(newFee))
        .to.emit(marketplace, "MarketFeeUpdated")
        .withArgs(newFee);

      expect(await marketplaceStorage.marketFee()).to.equal(newFee);
    });

    it("Should allow setting high fees", async function () {
      const highFee = 1100; // 11%

      await expect(marketplace.connect(owner).setMarketFee(highFee))
        .to.emit(marketplace, "MarketFeeUpdated")
        .withArgs(highFee);

      expect(await marketplaceStorage.marketFee()).to.equal(highFee);
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
