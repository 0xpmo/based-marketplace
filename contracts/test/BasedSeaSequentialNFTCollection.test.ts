// contracts/test/BasedSeaSequentialNFTCollection.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { BasedSeaSequentialNFTCollection } from "../typechain-types";
import { Signer } from "ethers";

describe("BasedSeaSequentialNFTCollection", function () {
  let nftCollection: BasedSeaSequentialNFTCollection;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let ownerAddress: string;
  let user1Address: string;
  let user2Address: string;

  const name = "Test Collection";
  const symbol = "TEST";
  const baseURI = "ipfs://QmBaseMetadata/";
  const unrevealedURI = "ipfs://QmUnrevealedMetadata";
  const contractURI = "ipfs://QmCollectionMetadata";
  const mintPrice = ethers.parseEther("0.1"); // 0.1 ETH
  const maxSupply = 100;
  const maxTokensPerWallet = 3;
  const royaltyFee = 500; // 5%

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();

    const BasedSeaSequentialNFTCollectionFactory =
      await ethers.getContractFactory("BasedSeaSequentialNFTCollection", owner);

    nftCollection = await BasedSeaSequentialNFTCollectionFactory.deploy(
      name,
      symbol,
      baseURI,
      unrevealedURI,
      contractURI,
      mintPrice,
      maxSupply,
      maxTokensPerWallet,
      royaltyFee,
      true, // mintingEnabled
      true, // startRevealed
      ownerAddress
    );

    await nftCollection.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      expect(await nftCollection.name()).to.equal(name);
      expect(await nftCollection.symbol()).to.equal(symbol);
    });

    it("Should set the correct URIs", async function () {
      expect(await nftCollection.baseURI()).to.equal(baseURI);
      expect(await nftCollection.unrevealedURI()).to.equal(unrevealedURI);
      expect(await nftCollection.contractURI()).to.equal(contractURI);
    });

    it("Should set the correct mint price", async function () {
      expect(await nftCollection.mintPrice()).to.equal(mintPrice);
    });

    it("Should set the correct supply limit", async function () {
      expect(await nftCollection.MAX_SUPPLY()).to.equal(maxSupply);
    });

    it("Should set the correct wallet limit", async function () {
      expect(await nftCollection.maxTokensPerWallet()).to.equal(
        maxTokensPerWallet
      );
    });

    it("Should set the correct royalty info", async function () {
      const [receiver, amount] = await nftCollection.royaltyInfo(
        1,
        ethers.parseEther("1.0")
      );
      expect(receiver).to.equal(ownerAddress);
      expect(amount).to.equal(ethers.parseEther("0.05")); // 5% of 1 ETH
    });

    it("Should set the correct owner", async function () {
      expect(await nftCollection.owner()).to.equal(ownerAddress);
    });
  });

  describe("Minting", function () {
    it("Should mint a token with sequential ID", async function () {
      // Mint first token
      await expect(
        nftCollection.connect(user1).mint(user1Address, { value: mintPrice })
      )
        .to.emit(nftCollection, "Transfer")
        .withArgs(ethers.ZeroAddress, user1Address, 1);

      expect(await nftCollection.ownerOf(1)).to.equal(user1Address);
      expect(await nftCollection.totalMinted()).to.equal(1);

      // Mint second token
      await expect(
        nftCollection.connect(user2).mint(user2Address, { value: mintPrice })
      )
        .to.emit(nftCollection, "Transfer")
        .withArgs(ethers.ZeroAddress, user2Address, 2);

      expect(await nftCollection.ownerOf(2)).to.equal(user2Address);
      expect(await nftCollection.totalMinted()).to.equal(2);
    });

    it("Should refund excess payment", async function () {
      const excessPayment = mintPrice + ethers.parseEther("0.05");
      const initialBalance = await ethers.provider.getBalance(user1Address);

      // Mint with excess payment
      const tx = await nftCollection
        .connect(user1)
        .mint(user1Address, { value: excessPayment });
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      // Get final balance
      const finalBalance = await ethers.provider.getBalance(user1Address);

      // Should have only deducted actual mint price plus gas
      expect(finalBalance).to.be.closeTo(
        initialBalance - mintPrice - gasCost,
        ethers.parseEther("0.0001") // Small buffer
      );
    });

    it("Should enforce wallet token limit", async function () {
      // Mint up to the wallet limit
      for (let i = 0; i < maxTokensPerWallet; i++) {
        await nftCollection
          .connect(user1)
          .mint(user1Address, { value: mintPrice });
      }

      // Attempt to mint one more
      await expect(
        nftCollection.connect(user1).mint(user1Address, { value: mintPrice })
      ).to.be.revertedWith("Would exceed max tokens per wallet");
    });

    it("Should not allow minting when disabled", async function () {
      // Disable minting
      await nftCollection.connect(owner).setMintingEnabled(false);

      await expect(
        nftCollection.connect(user1).mint(user1Address, { value: mintPrice })
      ).to.be.revertedWith("Minting is disabled");
    });

    it("Should not allow minting with insufficient payment", async function () {
      const lowPayment = mintPrice - BigInt(1);

      await expect(
        nftCollection.connect(user1).mint(user1Address, { value: lowPayment })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should not allow minting beyond max supply", async function () {
      // Deploy a collection with very small max supply
      const SmallCollection = await ethers.getContractFactory(
        "BasedSeaSequentialNFTCollection",
        owner
      );

      const smallCollection = await SmallCollection.deploy(
        "Small Collection",
        "SMALL",
        baseURI,
        unrevealedURI,
        contractURI,
        mintPrice,
        2, // maxSupply of 2
        10, // maxTokensPerWallet
        royaltyFee,
        true,
        true,
        ownerAddress
      );

      // Mint max supply
      await smallCollection
        .connect(user1)
        .mint(user1Address, { value: mintPrice });
      await smallCollection
        .connect(user1)
        .mint(user1Address, { value: mintPrice });

      // Try to mint one more
      await expect(
        smallCollection.connect(user1).mint(user1Address, { value: mintPrice })
      ).to.be.revertedWith("Max supply reached");
    });
  });

  describe("Owner Minting", function () {
    it("Should allow owner to batch mint tokens", async function () {
      const quantity = 5;
      const tx = await nftCollection
        .connect(owner)
        .ownerMint(user1Address, quantity);
      const receipt = await tx.wait();

      expect(await nftCollection.totalMinted()).to.equal(quantity);
      expect(await nftCollection.balanceOf(user1Address)).to.equal(quantity);

      // Check all token IDs are sequential
      for (let i = 1; i <= quantity; i++) {
        expect(await nftCollection.ownerOf(i)).to.equal(user1Address);
      }
    });

    it("Should enforce maximum batch size", async function () {
      const tooLarge = 51; // MAX_BATCH_SIZE is 50
      await expect(
        nftCollection.connect(owner).ownerMint(user1Address, tooLarge)
      ).to.be.revertedWith("Exceeds maximum batch size");
    });

    it("Should not allow non-owner to batch mint", async function () {
      await expect(
        nftCollection.connect(user1).ownerMint(user1Address, 5)
      ).to.be.revertedWithCustomError(
        nftCollection,
        "OwnableUnauthorizedAccount"
      );
    });
  });

  describe("Reveal Functionality", function () {
    it("Should return correct tokenURI based on reveal status", async function () {
      // Mint a token
      await nftCollection
        .connect(user1)
        .mint(user1Address, { value: mintPrice });

      // Check URI when revealed
      expect(await nftCollection.tokenURI(1)).to.equal(baseURI + "1");

      // Set to unrevealed
      await nftCollection.connect(owner).setRevealed(false);

      // Check URI when unrevealed
      expect(await nftCollection.tokenURI(1)).to.equal(unrevealedURI);

      // Reveal again
      await nftCollection.connect(owner).setRevealed(true);

      // Check URI is back to normal
      expect(await nftCollection.tokenURI(1)).to.equal(baseURI + "1");
    });

    it("Should allow owner to update URIs", async function () {
      const newBaseURI = "ipfs://QmNewBaseURI/";
      const newUnrevealedURI = "ipfs://QmNewUnrevealedURI";
      const newContractURI = "ipfs://QmNewContractURI";

      await nftCollection.connect(owner).setBaseURI(newBaseURI);
      await nftCollection.connect(owner).setUnrevealedURI(newUnrevealedURI);
      await nftCollection.connect(owner).setContractURI(newContractURI);

      expect(await nftCollection.baseURI()).to.equal(newBaseURI);
      expect(await nftCollection.unrevealedURI()).to.equal(newUnrevealedURI);
      expect(await nftCollection.contractURI()).to.equal(newContractURI);
    });
  });

  describe("Pausable Functionality", function () {
    beforeEach(async function () {
      // Mint a token for testing transfers
      await nftCollection
        .connect(user1)
        .mint(user1Address, { value: mintPrice });
    });

    it("Should allow transfers when not paused", async function () {
      await expect(
        nftCollection.connect(user1).transferFrom(user1Address, user2Address, 1)
      ).to.not.be.reverted;
    });

    it("Should prevent transfers when paused", async function () {
      // Pause the contract
      await nftCollection.connect(owner).pause();

      // Attempt a transfer
      await expect(
        nftCollection.connect(user1).transferFrom(user1Address, user2Address, 1)
      ).to.be.reverted; // Just expect any revert, not a specific message
    });

    it("Should prevent minting when paused", async function () {
      // Pause the contract
      await nftCollection.connect(owner).pause();

      // Try to mint
      await expect(
        nftCollection.connect(user2).mint(user2Address, { value: mintPrice })
      ).to.be.reverted; // Just expect any revert
    });

    it("Should allow unpausing the contract", async function () {
      // Pause the contract
      await nftCollection.connect(owner).pause();

      // Verify transfer fails
      await expect(
        nftCollection.connect(user1).transferFrom(user1Address, user2Address, 1)
      ).to.be.reverted;

      // Unpause
      await nftCollection.connect(owner).unpause();

      // Verify transfer now works
      await expect(
        nftCollection.connect(user1).transferFrom(user1Address, user2Address, 1)
      ).to.not.be.reverted;
    });
  });

  describe("Withdrawal Functionality", function () {
    it("Should allow owner to withdraw contract balance", async function () {
      // Generate some balance by minting
      await nftCollection
        .connect(user1)
        .mint(user1Address, { value: mintPrice });
      await nftCollection
        .connect(user2)
        .mint(user2Address, { value: mintPrice });

      const initialOwnerBalance = await ethers.provider.getBalance(
        ownerAddress
      );
      const contractBalance = await ethers.provider.getBalance(
        await nftCollection.getAddress()
      );

      // Withdraw funds
      const tx = await nftCollection.connect(owner).withdraw();
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      // Check owner received funds
      const finalOwnerBalance = await ethers.provider.getBalance(ownerAddress);
      expect(finalOwnerBalance).to.be.closeTo(
        initialOwnerBalance + contractBalance - gasCost,
        ethers.parseEther("0.0001") // Small buffer
      );

      // Check contract balance is zero
      expect(
        await ethers.provider.getBalance(await nftCollection.getAddress())
      ).to.equal(0);
    });

    it("Should not allow non-owner to withdraw", async function () {
      await nftCollection
        .connect(user1)
        .mint(user1Address, { value: mintPrice });

      await expect(
        nftCollection.connect(user1).withdraw()
      ).to.be.revertedWithCustomError(
        nftCollection,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should not allow withdrawal if balance is zero", async function () {
      await expect(nftCollection.connect(owner).withdraw()).to.be.revertedWith(
        "No balance to withdraw"
      );
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set mint price", async function () {
      const newPrice = ethers.parseEther("0.2");
      await nftCollection.connect(owner).setMintPrice(newPrice);
      expect(await nftCollection.mintPrice()).to.equal(newPrice);
    });

    it("Should allow owner to update royalty info", async function () {
      const newFee = 750; // 7.5%
      await nftCollection.connect(owner).setRoyaltyInfo(user1Address, newFee);

      const [receiver, amount] = await nftCollection.royaltyInfo(
        1,
        ethers.parseEther("1.0")
      );
      expect(receiver).to.equal(user1Address);
      expect(amount).to.equal(ethers.parseEther("0.075")); // 7.5% of 1 ETH
    });

    it("Should not allow setting royalty fee above 10%", async function () {
      const tooHighFee = 1100; // 11%
      await expect(
        nftCollection.connect(owner).setRoyaltyInfo(user1Address, tooHighFee)
      ).to.be.revertedWith("Royalty fee cannot exceed 10%");
    });
  });
});
