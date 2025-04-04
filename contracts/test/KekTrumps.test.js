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

    describe("Complex Minting Scenarios", function () {
      it("Should handle multiple successive mints of different rarities", async function () {
        // Test sequence of mints
        const mintSequence = [
          { rarity: 0, amount: 3 }, // Bronze
          { rarity: 1, amount: 2 }, // Silver
          { rarity: 0, amount: 3 }, // Bronze again
          { rarity: 2, amount: 1 }, // Gold
          { rarity: 1, amount: 2 }, // Silver again
        ];

        console.log("\n=== Starting Multiple Mint Test ===");

        for (let i = 0; i < mintSequence.length; i++) {
          const { rarity, amount } = mintSequence[i];
          const price = RARITY_PRICES[rarity];
          const totalCost = price * BigInt(amount);

          console.log(`\nAttempting mint #${i + 1}:`);
          console.log(`Rarity: ${rarity}, Amount: ${amount}`);

          // Get state before mint
          const beforeState = await getContractState(kekTrumps, rarity);
          console.log("Before mint state:", beforeState);

          // Perform mint
          const mintTx = await kekTrumps
            .connect(addr1)
            .mint(addr1.address, rarity, amount, { value: totalCost });

          const receipt = await mintTx.wait();

          // Log minting events
          console.log("\nMint events:");
          for (const log of receipt.logs) {
            try {
              const event = kekTrumps.interface.parseLog(log);
              if (event && event.name === "TokenMinted") {
                console.log(
                  `Token minted - ID: ${event.args.tokenId}, Character: ${event.args.characterId}, Rarity: ${event.args.rarity}`
                );
              }
            } catch (e) {
              // Skip non-contract events
            }
          }

          // Get state after mint
          const afterState = await getContractState(kekTrumps, rarity);
          console.log("After mint state:", afterState);

          // Verify changes
          expect(afterState.totalMinted).to.equal(
            beforeState.totalMinted + amount
          );
        }
      });

      it("Should handle minting at supply boundaries", async function () {
        // Add a character with VERY limited supply
        await kekTrumps.addCharacter(
          5, // characterId
          "LimitedChar",
          2, // bronze - extremely limited
          2, // silver - extremely limited
          2, // gold - extremely limited
          1 // green - extremely limited
        );

        // Test each rarity
        for (let rarity = 0; rarity < 4; rarity++) {
          console.log(`\n=== Testing rarity ${rarity} supply limits ===`);
          const price = RARITY_PRICES[rarity];

          // Log initial state
          const initialState = await getContractState(kekTrumps, rarity);
          console.log("Initial state:", initialState);

          // First mint: Mint all but one
          const firstMintAmount = 1;
          console.log(`Minting ${firstMintAmount} tokens...`);
          await kekTrumps
            .connect(addr1)
            .mint(addr1.address, rarity, firstMintAmount, {
              value: price * BigInt(firstMintAmount),
            });

          // Log middle state
          const middleState = await getContractState(kekTrumps, rarity);
          console.log("After first mint:", middleState);

          // Second mint: Mint the last one
          console.log("Minting final token...");
          await kekTrumps
            .connect(addr1)
            .mint(addr1.address, rarity, 1, { value: price });

          // Log state after filling supply
          const finalState = await getContractState(kekTrumps, rarity);
          console.log("After final mint:", finalState);

          // Third mint: Should fail as supply is exhausted
          console.log("Attempting to mint beyond supply...");
          await expect(
            kekTrumps
              .connect(addr1)
              .mint(addr1.address, rarity, 1, { value: price })
          ).to.be.revertedWith("Supply exhausted during mint");

          console.log(`=== Completed rarity ${rarity} test ===\n`);
        }
      });

      it("Should handle rapid successive mints correctly", async function () {
        // Simulate multiple users minting simultaneously
        const users = [addr1, addr2];
        const mintPromises = [];

        for (let user of users) {
          // Each user attempts multiple mints of different rarities
          mintPromises.push(
            kekTrumps.connect(user).mint(
              user.address,
              0, // Bronze
              3,
              { value: RARITY_PRICES[0] * BigInt(3) }
            )
          );
          mintPromises.push(
            kekTrumps.connect(user).mint(
              user.address,
              1, // Silver
              2,
              { value: RARITY_PRICES[1] * BigInt(2) }
            )
          );
        }

        // Execute all mints simultaneously
        await Promise.all(mintPromises);

        // Verify final state
        const finalState = await getContractState(kekTrumps, 0);
        console.log("Final state after rapid mints:", finalState);
      });
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

// Helper function to get contract state
async function getContractState(contract, rarity) {
  const state = {
    totalMinted: 0,
    availableCharacters: [],
    characterSupplies: {},
  };

  // Get available characters
  const available = await contract.getAvailableCharactersForRarity(rarity);
  state.availableCharacters = available.map((x) => x.toString());

  // Get minted amounts for each character
  for (let i = 1; i <= 4; i++) {
    const charInfo = await contract.getCharacter(i);
    state.characterSupplies[i] = {
      minted: Number(charInfo.minted[rarity]),
      maxSupply: Number(charInfo.maxSupply[rarity]),
    };
    state.totalMinted += Number(charInfo.minted[rarity]);
  }

  return state;
}

async function getAvailableSupply(contract, rarity) {
  const available = await contract.getAvailableCharactersForRarity(rarity);
  console.log(
    `Available characters for rarity ${rarity}:`,
    available.map((x) => x.toString())
  );
  return available.length;
}
