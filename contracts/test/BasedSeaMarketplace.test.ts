// contracts/test/BasedSeaMarketplace.test.ts
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
  BasedSeaMarketplace,
  BasedSeaMarketplaceStorage,
  BasedSeaSequentialNFTCollection,
} from "../typechain-types";
import { Signer } from "ethers";

describe("BasedSeaMarketplace", function () {
  let marketplace: BasedSeaMarketplace;
  let marketplaceStorage: BasedSeaMarketplaceStorage;
  let nftCollection: BasedSeaSequentialNFTCollection;
  let owner: Signer;
  let seller: Signer;
  let buyer: Signer;
  let feeRecipient: Signer;
  let ownerAddress: string;
  let sellerAddress: string;
  let buyerAddress: string;
  let feeRecipientAddress: string;

  const marketFee = 250; // 2.5%
  const collectionName = "Based Collection";
  const collectionSymbol = "BASED";
  const baseURI = "ipfs://QmBaseMetadata/";
  const unrevealedURI = "ipfs://QmUnrevealedMetadata";
  const contractURI = "ipfs://QmCollectionMetadata";
  const mintPrice = ethers.parseEther("0.1"); // 0.1 ETH
  const maxSupply = 100;
  const maxTokensPerWallet = 5;
  const royaltyFee = 250; // 2.5%
  const listingPrice = ethers.parseEther("0.2"); // 0.2 ETH

  beforeEach(async function () {
    // Get signers
    [owner, seller, buyer, feeRecipient] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    sellerAddress = await seller.getAddress();
    buyerAddress = await buyer.getAddress();
    feeRecipientAddress = await feeRecipient.getAddress();

    // Deploy storage contract as upgradeable
    const BasedSeaMarketplaceStorageFactory = await ethers.getContractFactory(
      "BasedSeaMarketplaceStorage",
      owner
    );
    marketplaceStorage = (await upgrades.deployProxy(
      BasedSeaMarketplaceStorageFactory,
      [feeRecipientAddress],
      { initializer: "initialize", kind: "uups" }
    )) as unknown as BasedSeaMarketplaceStorage;

    await marketplaceStorage.waitForDeployment();

    // Deploy marketplace as upgradeable
    const BasedSeaMarketplaceFactory = await ethers.getContractFactory(
      "BasedSeaMarketplace",
      owner
    );
    marketplace = (await upgrades.deployProxy(
      BasedSeaMarketplaceFactory,
      [await marketplaceStorage.getAddress()],
      { initializer: "initialize", kind: "uups" }
    )) as unknown as BasedSeaMarketplace;

    await marketplace.waitForDeployment();

    // Transfer ownership of storage to marketplace
    await marketplaceStorage.transferOwnership(await marketplace.getAddress());

    // Deploy NFT collection
    const BasedSeaSequentialNFTCollectionFactory =
      await ethers.getContractFactory(
        "BasedSeaSequentialNFTCollection",
        seller
      );
    nftCollection = await BasedSeaSequentialNFTCollectionFactory.deploy(
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
      true, // startRevealed
      sellerAddress // seller is the owner/creator
    );

    // Mint an NFT for the seller
    await nftCollection
      .connect(seller)
      .mint(sellerAddress, { value: mintPrice });

    // Approve marketplace to transfer the NFT
    await nftCollection
      .connect(seller)
      .setApprovalForAll(await marketplace.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the marketplace storage correctly", async function () {
      expect(await marketplace.marketplaceStorage()).to.equal(
        await marketplaceStorage.getAddress()
      );
    });

    it("Should set the correct market fee", async function () {
      expect(await marketplaceStorage.marketFee()).to.equal(marketFee);
    });

    it("Should set the correct owner of marketplace", async function () {
      expect(await marketplace.owner()).to.equal(ownerAddress);
    });

    it("Should set the correct owner of storage", async function () {
      expect(await marketplaceStorage.owner()).to.equal(
        await marketplace.getAddress()
      );
    });

    it("Should set the correct fee recipient", async function () {
      expect(await marketplaceStorage.feeRecipient()).to.equal(
        feeRecipientAddress
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
          sellerAddress,
          await nftCollection.getAddress(),
          1,
          listingPrice,
          false, // not private
          ethers.ZeroAddress // no allowed buyer
        );

      const listing = await marketplaceStorage.getListing(
        await nftCollection.getAddress(),
        1
      );

      expect(listing.seller).to.equal(sellerAddress);
      expect(listing.nftContract).to.equal(await nftCollection.getAddress());
      expect(listing.tokenId).to.equal(1);
      expect(listing.price).to.equal(listingPrice);
      expect(listing.status).to.equal(1); // Active
      expect(listing.isPrivate).to.equal(false);
      expect(listing.allowedBuyer).to.equal(ethers.ZeroAddress);

      expect(
        await marketplaceStorage.isListed(await nftCollection.getAddress(), 1)
      ).to.equal(true);
    });

    it("Should allow creating a private listing", async function () {
      await expect(
        marketplace
          .connect(seller)
          .createPrivateListing(
            await nftCollection.getAddress(),
            1,
            listingPrice,
            buyerAddress,
            1
          )
      )
        .to.emit(marketplace, "ItemListed")
        .withArgs(
          sellerAddress,
          await nftCollection.getAddress(),
          1,
          listingPrice,
          true, // private listing
          buyerAddress // allowed buyer
        );

      const listing = await marketplaceStorage.getListing(
        await nftCollection.getAddress(),
        1
      );
      expect(listing.isPrivate).to.equal(true);
      expect(listing.allowedBuyer).to.equal(buyerAddress);
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

    it("Should not allow creating a private listing for yourself", async function () {
      await expect(
        marketplace
          .connect(seller)
          .createPrivateListing(
            await nftCollection.getAddress(),
            1,
            listingPrice,
            sellerAddress,
            1
          )
      ).to.be.revertedWith("Cannot create private listing for yourself");
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
          sellerAddress,
          buyerAddress,
          await nftCollection.getAddress(),
          1,
          listingPrice
        );

      // Check NFT ownership
      expect(await nftCollection.ownerOf(1)).to.equal(buyerAddress);

      // Check listing is no longer active
      expect(
        await marketplaceStorage.isListed(await nftCollection.getAddress(), 1)
      ).to.equal(false);

      const listing = await marketplaceStorage.getListing(
        await nftCollection.getAddress(),
        1
      );
      expect(listing.status).to.equal(2); // Sold
    });

    it("Should distribute funds correctly when buying an NFT", async function () {
      // Calculate expected amounts
      const marketFeeAmount =
        (listingPrice * BigInt(marketFee)) / BigInt(10000);
      const royaltyAmount = (listingPrice * BigInt(royaltyFee)) / BigInt(10000);
      const sellerAmount = listingPrice - marketFeeAmount - royaltyAmount;

      // Get initial balances
      const initialSellerBalance = await ethers.provider.getBalance(
        sellerAddress
      );
      const initialRoyaltyReceiverBalance = await ethers.provider.getBalance(
        sellerAddress
      ); // Creator is seller
      const initialFeeRecipientBalance = await ethers.provider.getBalance(
        feeRecipientAddress
      );

      // Buy the NFT
      await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice });

      // Check for accumulated marketplace fees
      expect(await marketplaceStorage.accumulatedFees()).to.equal(
        marketFeeAmount
      );

      // Check seller received payment
      const finalSellerBalance = await ethers.provider.getBalance(
        sellerAddress
      );
      expect(finalSellerBalance).to.equal(
        initialSellerBalance + sellerAmount + royaltyAmount
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
      const excess = excessPrice - listingPrice;

      // Get initial balance
      const initialBuyerBalance = await ethers.provider.getBalance(
        buyerAddress
      );

      // Buy with excess payment
      const tx = await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: excessPrice });
      const receipt = await tx.wait();

      // Calculate gas cost
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      // Get final balance
      const finalBuyerBalance = await ethers.provider.getBalance(buyerAddress);

      // Buyer should have paid only the listing price plus gas
      expect(finalBuyerBalance).to.be.closeTo(
        initialBuyerBalance - listingPrice - gasCost,
        ethers.parseEther("0.0001") // Small buffer
      );
    });

    it("Should enforce private listing restrictions", async function () {
      // Cancel the current listing
      await marketplace
        .connect(seller)
        .cancelListing(await nftCollection.getAddress(), 1);

      // Create a private listing for a specific buyer
      const otherBuyer = (await ethers.getSigners())[4];
      const otherBuyerAddress = await otherBuyer.getAddress();

      await marketplace
        .connect(seller)
        .createPrivateListing(
          await nftCollection.getAddress(),
          1,
          listingPrice,
          otherBuyerAddress,
          1
        );

      // Try to buy with unauthorized buyer
      await expect(
        marketplace
          .connect(buyer)
          .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice })
      ).to.be.revertedWith("Not authorized for this private listing");

      // Buy with authorized buyer
      await expect(
        marketplace
          .connect(otherBuyer)
          .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice })
      ).to.not.be.reverted;
    });
  });

  describe("Offer Execution with Signatures", function () {
    let tokenId: number;
    let offerPrice: bigint;
    let offerExpiration: number;
    let offerSignature: string;

    beforeEach(async function () {
      // Mint another NFT for testing offers
      await nftCollection
        .connect(seller)
        .mint(sellerAddress, { value: mintPrice });
      tokenId = 2;
      offerPrice = ethers.parseEther("0.15");

      // Set expiration to 1 hour from now
      offerExpiration = Math.floor(Date.now() / 1000) + 3600;

      // Get the offer hash
      const offerHash = await marketplace.getOfferHash(
        await nftCollection.getAddress(),
        tokenId,
        offerPrice,
        buyerAddress,
        offerExpiration
      );

      // Sign the offer hash with seller's private key
      offerSignature = await seller.signMessage(ethers.getBytes(offerHash));
    });

    it("Should execute a valid offer", async function () {
      // Get initial balances
      const initialSellerBalance = await ethers.provider.getBalance(
        sellerAddress
      );
      const initialBuyerBalance = await ethers.provider.getBalance(
        buyerAddress
      );

      // Execute the offer
      const tx = await marketplace
        .connect(buyer)
        .executeOffer(
          await nftCollection.getAddress(),
          tokenId,
          offerPrice,
          sellerAddress,
          offerExpiration,
          offerSignature,
          { value: offerPrice }
        );

      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      // Verify NFT ownership transferred
      expect(await nftCollection.ownerOf(tokenId)).to.equal(buyerAddress);

      // Verify seller received payment
      const finalSellerBalance = await ethers.provider.getBalance(
        sellerAddress
      );

      // Calculate expected amounts
      const marketFeeAmount = (offerPrice * BigInt(marketFee)) / BigInt(10000);
      const royaltyAmount = (offerPrice * BigInt(royaltyFee)) / BigInt(10000);
      const sellerAmount = offerPrice - marketFeeAmount;

      // Since seller is also the royalty receiver, they should get both payments
      expect(finalSellerBalance).to.be.closeTo(
        initialSellerBalance + sellerAmount,
        ethers.parseEther("0.0001") // Small buffer
      );

      // Verify buyer spent correct amount
      const finalBuyerBalance = await ethers.provider.getBalance(buyerAddress);
      expect(finalBuyerBalance).to.be.closeTo(
        initialBuyerBalance - offerPrice - gasCost,
        ethers.parseEther("0.0001") // Small buffer
      );

      // Verify the offer is marked as used
      const offerId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          [
            "address",
            "uint256",
            "uint256",
            "address",
            "address",
            "uint256",
            "uint256",
          ],
          [
            await nftCollection.getAddress(),
            tokenId,
            offerPrice,
            sellerAddress,
            buyerAddress,
            offerExpiration,
            await ethers.provider.getNetwork().then((n) => n.chainId),
          ]
        )
      );

      expect(await marketplaceStorage.isOfferUsed(offerId)).to.equal(true);
    });

    it("Should not execute an expired offer", async function () {
      // Create an expired offer
      const expiredTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      const expiredOfferHash = await marketplace.getOfferHash(
        await nftCollection.getAddress(),
        tokenId,
        offerPrice,
        buyerAddress,
        expiredTime
      );

      const expiredSignature = await seller.signMessage(
        ethers.getBytes(expiredOfferHash)
      );

      await expect(
        marketplace
          .connect(buyer)
          .executeOffer(
            await nftCollection.getAddress(),
            tokenId,
            offerPrice,
            sellerAddress,
            expiredTime,
            expiredSignature,
            { value: offerPrice }
          )
      ).to.be.revertedWith("Expiration must be in the future");
    });

    it("Should not execute an offer with invalid signature", async function () {
      // Sign with buyer instead of seller
      const invalidSignature = await buyer.signMessage(
        ethers.getBytes(
          await marketplace.getOfferHash(
            await nftCollection.getAddress(),
            tokenId,
            offerPrice,
            buyerAddress,
            offerExpiration
          )
        )
      );

      await expect(
        marketplace
          .connect(buyer)
          .executeOffer(
            await nftCollection.getAddress(),
            tokenId,
            offerPrice,
            sellerAddress,
            offerExpiration,
            invalidSignature,
            { value: offerPrice }
          )
      ).to.be.revertedWith("Invalid seller signature");
    });

    it("Should not execute an offer with insufficient payment", async function () {
      await expect(
        marketplace
          .connect(buyer)
          .executeOffer(
            await nftCollection.getAddress(),
            tokenId,
            offerPrice,
            sellerAddress,
            offerExpiration,
            offerSignature,
            { value: offerPrice - ethers.parseEther("0.05") }
          )
      ).to.be.revertedWith("Insufficient payment");
    });

    // it("Should not allow executing an offer twice", async function () {
    //   // Mint another NFT for this test to ensure seller still owns one
    //   await nftCollection
    //     .connect(seller)
    //     .mint(sellerAddress, { value: mintPrice });
    //   const newTokenId = 3;

    //   // Create an offer for this new token
    //   const newOfferHash = await marketplace.getOfferHash(
    //     await nftCollection.getAddress(),
    //     newTokenId,
    //     offerPrice,
    //     buyerAddress,
    //     offerExpiration
    //   );

    //   const newOfferSignature = await seller.signMessage(
    //     ethers.getBytes(newOfferHash)
    //   );

    //   // Execute once
    //   await marketplace
    //     .connect(buyer)
    //     .executeOffer(
    //       await nftCollection.getAddress(),
    //       newTokenId,
    //       offerPrice,
    //       sellerAddress,
    //       offerExpiration,
    //       newOfferSignature,
    //       { value: offerPrice }
    //     );

    //   // Try to execute again - should fail with "Offer already used"
    //   await expect(
    //     marketplace
    //       .connect(buyer)
    //       .executeOffer(
    //         await nftCollection.getAddress(),
    //         newTokenId,
    //         offerPrice,
    //         sellerAddress,
    //         offerExpiration,
    //         newOfferSignature,
    //         { value: offerPrice }
    //       )
    //   ).to.be.revertedWith("Offer already used");
    // });
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
        .withArgs(sellerAddress, await nftCollection.getAddress(), 1);

      expect(
        await marketplaceStorage.isListed(await nftCollection.getAddress(), 1)
      ).to.equal(false);

      const listing = await marketplaceStorage.getListing(
        await nftCollection.getAddress(),
        1
      );
      expect(listing.status).to.equal(3); // Canceled
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

  describe("Failed Payments", function () {
    // it("Should allow claiming failed payments", async function () {
    //   // We need to simulate a failed payment by directly adding it to storage through the marketplace
    //   const failedAmount = ethers.parseEther("0.1");

    //   // First, transfer ownership of storage back to owner temporarily for this test
    //   await owner.sendTransaction({
    //     to: await marketplace.getAddress(),
    //     data: marketplace.interface.encodeFunctionData("setStorageContract", [
    //       await marketplaceStorage.getAddress(),
    //     ]),
    //   });

    //   // Now have the marketplace add the failed payment
    //   await marketplaceStorage
    //     .connect(owner)
    //     .addFailedPayment(sellerAddress, failedAmount);

    //   // Verify failed payment was recorded
    //   expect(await marketplaceStorage.failedPayments(sellerAddress)).to.equal(
    //     failedAmount
    //   );

    //   // Get initial seller balance
    //   const initialSellerBalance = await ethers.provider.getBalance(
    //     sellerAddress
    //   );

    //   // Claim the failed payment
    //   const tx = await marketplace.connect(seller).claimFailedPayment();
    //   const receipt = await tx.wait();
    //   const gasCost = receipt!.gasUsed * receipt!.gasPrice;

    //   // Verify failed payment is cleared
    //   expect(await marketplaceStorage.failedPayments(sellerAddress)).to.equal(
    //     0
    //   );

    //   // Verify seller received the funds
    //   const finalSellerBalance = await ethers.provider.getBalance(
    //     sellerAddress
    //   );
    //   expect(finalSellerBalance).to.be.closeTo(
    //     initialSellerBalance + failedAmount - gasCost,
    //     ethers.parseEther("0.0001") // Small buffer
    //   );
    // });

    it("Should not allow claiming if no failed payments exist", async function () {
      await expect(
        marketplace.connect(buyer).claimFailedPayment()
      ).to.be.revertedWith("No failed payments to claim");
    });
  });

  describe("Marketplace Permissions", function () {
    it("Should verify marketplace has permission to call storage", async function () {
      // Check ownership - use the existing contracts from beforeEach
      const storageOwner = await marketplaceStorage.owner();
      expect(storageOwner).to.equal(
        await marketplace.getAddress(),
        "Storage not owned by marketplace"
      );

      // Check if marketplaceStorage matches expected storage address
      const storedAddress = await marketplace.marketplaceStorage();
      expect(storedAddress).to.equal(
        await marketplaceStorage.getAddress(),
        "Marketplace's storage reference incorrect"
      );
    });
  });

  describe("Administrative Functions", function () {
    it("Should allow owner to withdraw accumulated fees", async function () {
      // First list an NFT
      await marketplace
        .connect(seller)
        .listItem(await nftCollection.getAddress(), 1, listingPrice);

      // Generate some fees by selling an NFT
      await marketplace
        .connect(buyer)
        .buyItem(await nftCollection.getAddress(), 1, { value: listingPrice });

      // Calculate market fee
      const marketFeeAmount =
        (listingPrice * BigInt(marketFee)) / BigInt(10000);

      // Verify fees were accumulated
      expect(await marketplaceStorage.accumulatedFees()).to.equal(
        marketFeeAmount
      );

      // Get initial fee recipient balance
      const initialFeeRecipientBalance = await ethers.provider.getBalance(
        feeRecipientAddress
      );

      // Withdraw fees
      await marketplace.connect(owner).withdrawAccumulatedFees();

      // Verify fees were reset
      expect(await marketplaceStorage.accumulatedFees()).to.equal(0);

      // Verify fee recipient received the fees
      const finalFeeRecipientBalance = await ethers.provider.getBalance(
        feeRecipientAddress
      );
      expect(finalFeeRecipientBalance).to.equal(
        initialFeeRecipientBalance + marketFeeAmount
      );
    });

    it("Should allow owner to update market fee", async function () {
      const newFee = 300; // 3%

      await expect(marketplace.connect(owner).setMarketFee(newFee))
        .to.emit(marketplace, "MarketFeeUpdated")
        .withArgs(newFee);

      expect(await marketplaceStorage.marketFee()).to.equal(newFee);
    });

    it("Should allow owner to set fee recipient", async function () {
      const newRecipient = await (await ethers.getSigners())[5].getAddress();

      await expect(marketplace.connect(owner).setFeeRecipient(newRecipient))
        .to.emit(marketplace, "FeeRecipientUpdated")
        .withArgs(newRecipient);

      expect(await marketplaceStorage.feeRecipient()).to.equal(newRecipient);
    });

    it("Should allow owner to toggle royalties", async function () {
      await expect(marketplace.connect(owner).setRoyaltiesDisabled(true))
        .to.emit(marketplace, "RoyaltiesStatusChanged")
        .withArgs(true);

      expect(await marketplaceStorage.royaltiesDisabled()).to.equal(true);
    });

    it("Should allow owner to pause the marketplace", async function () {
      await expect(marketplace.connect(owner).setPaused(true)).to.emit(
        marketplace,
        "EmergencyPaused"
      );

      expect(await marketplaceStorage.paused()).to.equal(true);

      // Operations should be blocked when paused
      await expect(
        marketplace
          .connect(seller)
          .listItem(await nftCollection.getAddress(), 1, listingPrice)
      ).to.be.revertedWith("Contract is paused");

      // Unpause
      await expect(marketplace.connect(owner).setPaused(false)).to.emit(
        marketplace,
        "EmergencyUnpaused"
      );

      expect(await marketplaceStorage.paused()).to.equal(false);
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
