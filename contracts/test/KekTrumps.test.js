const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("KekTrumps", function () {
  let KekTrumps;
  let kekTrumps;
  let owner;
  let addr1;
  let addr2;

  // Constants for initialization
  const NAME = "KekTrumps";
  const SYMBOL = "KEKT";
  const BASE_URI = "https://api.kektrumps.com/metadata/";
  const CONTRACT_URI = "https://api.kektrumps.com/contract/metadata.json";
  const RARITY_PRICES = [
    ethers.parseEther("0.01"), // Bronze
    ethers.parseEther("0.02"), // Silver
    ethers.parseEther("0.03"), // Gold
    ethers.parseEther("0.04"), // Green
  ];

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy contract
    KekTrumps = await ethers.getContractFactory("KekTrumps");

    // Setup withdrawal wallets and percentages
    const withdrawalWallets = [
      owner.address,
      addr1.address,
      addr2.address,
      addr1.address,
    ];
    const withdrawalPercentages = [2500, 2500, 2500, 2500]; // Equal 25% split

    kekTrumps = await upgrades.deployProxy(KekTrumps, [
      NAME,
      SYMBOL,
      BASE_URI,
      CONTRACT_URI,
      owner.address, // royalty recipient
      1000, // 10% royalty
      RARITY_PRICES,
      withdrawalWallets,
      withdrawalPercentages,
    ]);

    await kekTrumps.waitForDeployment();

    // Add some test characters
    await kekTrumps.addCharacter(
      1, // characterId
      "Pepe", // name
      100, // bronze supply
      50, // silver supply
      25, // gold supply
      10 // green supply
    );

    await kekTrumps.addCharacter(2, "Wojak", 100, 50, 25, 10);

    await kekTrumps.addCharacter(3, "Doge", 100, 50, 25, 10);

    await kekTrumps.addCharacter(4, "Bob", 100, 50, 25, 10);
  });

  describe("Minting", function () {
    it("Should allow minting of bronze tokens", async function () {
      const mintAmount = 5;
      const price = RARITY_PRICES[0]; // Bronze price
      const totalCost = price * BigInt(mintAmount);

      // Mint tokens
      const mintTx = await kekTrumps.connect(addr1).mint(
        addr1.address,
        0, // Bronze rarity
        mintAmount,
        { value: totalCost }
      );

      // Wait for transaction
      const receipt = await mintTx.wait();

      // Log events for debugging
      console.log("\n=== Minting Debug Logs ===");
      receipt.logs.forEach((log) => {
        try {
          const event = kekTrumps.interface.parseLog(log);
          if (event) {
            if (event.name === "DebugAvailable") {
              console.log(
                "\nAvailable Characters:",
                event.args.available.map((x) => x.toString()),
                "\nMessage:",
                event.args.message
              );
            }
            if (event.name === "DebugSelection") {
              console.log(
                "\nSelected Character:",
                event.args.selectedCharacter.toString(),
                "\nRandom Number:",
                event.args.randomNumber.toString(),
                "\nArray Length:",
                event.args.arrayLength.toString(),
                "\nMessage:",
                event.args.message
              );
            }
            if (event.name === "TokenMinted") {
              console.log(
                "\nToken Minted:",
                "\nTo:",
                event.args.to,
                "\nToken ID:",
                event.args.tokenId.toString(),
                "\nCharacter ID:",
                event.args.characterId.toString(),
                "\nRarity:",
                event.args.rarity.toString(),
                "\nAmount:",
                event.args.amount.toString()
              );
            }
          }
        } catch (e) {
          // Skip logs that aren't from our contract
        }
      });

      // Verify total minted amount
      let totalMinted = 0;
      for (let i = 1; i <= 4; i++) {
        const charInfo = await kekTrumps.getCharacter(i);
        totalMinted += Number(charInfo.minted[0]); // Bronze rarity
      }
      expect(totalMinted).to.equal(mintAmount);
    });

    it("Should fail when trying to mint with insufficient payment", async function () {
      const mintAmount = 5;
      const price = RARITY_PRICES[0]; // Bronze price
      const insufficientPayment = price * BigInt(mintAmount) - BigInt(1);

      await expect(
        kekTrumps.connect(addr1).mint(
          addr1.address,
          0, // Bronze rarity
          mintAmount,
          { value: insufficientPayment }
        )
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should fail when trying to mint more than maxMintPerTx", async function () {
      const tooManyTokens = 11; // Default maxMintPerTx for Bronze is 10
      const price = RARITY_PRICES[0];

      await expect(
        kekTrumps.connect(addr1).mint(
          addr1.address,
          0, // Bronze rarity
          tooManyTokens,
          { value: price * BigInt(tooManyTokens) }
        )
      ).to.be.revertedWith("Invalid amount");
    });
  });
});
