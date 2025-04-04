// Deployment script using Hardhat
// TO RUN:
// First run create-kektrumps-metadata.ts to create the metadata
// ### IMPORTANT: Then upload folder to pinata and copy and past folder cid into FOLDER_HASH

// npx hardhat run scripts/deploy-kek-trumps.ts --network localhost
import { ethers, upgrades } from "hardhat";
import { KekTrumps } from "../typechain-types";

async function main() {
  console.log("Deploying KekTrumps NFT contract...");

  const FOLDER_HASH =
    "bafybeibejwwzwqxgfj4rgwrmlj6p7hpxbhf6yfil33bzhc3ccvitjwpnsu";

  const baseURI = `ipfs://${FOLDER_HASH}/`;
  const contractURI = `ipfs://${FOLDER_HASH}/collection`;

  // Get contract factory
  const KekTrumpsFactory = await ethers.getContractFactory("KekTrumps");

  // Default withdrawal wallets
  const wallet1 = "0x44dF92D10E91fa4D7E9eAd9fF6A6224c88ae5152"; // 10%
  const wallet2 = "0x7320C98A88A982D9d194FffBfdc52AD65841334D"; // 75%
  const wallet3 = "0x2a0F6eb0352F39BC5A49C8BcA2652eD3e3A1Be0B"; // 10%
  const wallet4 = "0xb556CC65A8678fa27818137832c82D1E387deF03"; // 5%

  // Withdrawal percentages in basis points (100% = 10000)
  const wallet1Percentage = 1000; // 10%
  const wallet2Percentage = 7500; // 75%
  const wallet3Percentage = 1000; // 10%
  const wallet4Percentage = 500; // 5%

  // Deploy as upgradeable contract
  const kekTrumps = (await upgrades.deployProxy(
    KekTrumpsFactory,
    [
      "Kek Trumps", // name
      "KEKT", // symbol
      baseURI, // Base URI for token metadata
      contractURI, // Contract URI for collection metadata
      "0x7320C98A88A982D9d194FffBfdc52AD65841334D", // Royalty recipient (using the 75% recipient from withdraw)
      250, // Royalty percentage in basis points (2.5%) - using uint96 as required by OpenZeppelin's ERC2981
      [
        ethers.parseEther("0.05"), // Bronze price
        ethers.parseEther("0.10"), // Silver price
        ethers.parseEther("0.20"), // Gold price
        ethers.parseEther("0.50"), // Green price
      ],
      [wallet1, wallet2, wallet3, wallet4], // Withdrawal wallets
      [
        wallet1Percentage,
        wallet2Percentage,
        wallet3Percentage,
        wallet4Percentage,
      ], // Withdrawal percentages
    ],
    {
      initializer: "initialize",
      kind: "uups",
    }
  )) as unknown as KekTrumps;

  await kekTrumps.waitForDeployment();
  console.log("KekTrumps deployed to:", await kekTrumps.getAddress());

  // Verify the contract on Etherscan (for main networks)
  // Uncomment this block when deploying to a main network
  /*
  console.log("Waiting for transaction confirmations...");
  await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
  
  try {
    await hre.run("verify:verify", {
      address: await kekTrumps.getAddress(),
      constructorArguments: [],
    });
    console.log("Contract verified on Etherscan");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
  */

  // Add characters based on the CSV data
  console.log("Adding characters...");

  // Character 1: Nakapepo Card
  await kekTrumps.addCharacter(
    1, // characterId
    "Nakapepo Card", // name
    15, // bronzeSupply
    10, // silverSupply
    7, // goldSupply
    2 // greenSupply
  );

  // Character 2: Pepe Burgundy
  await kekTrumps.addCharacter(
    2, // characterId
    "Pepe Burgundy", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );

  // Character 3: Magic Internet Pepe
  await kekTrumps.addCharacter(
    3, // characterId
    "Magic Internet Pepe", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );

  // Character 4: Shadilay Slinger
  await kekTrumps.addCharacter(
    4, // characterId
    "Shadilay Slinger", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );

  // Character 5: Pepe Mcfly
  await kekTrumps.addCharacter(
    5, // characterId
    "Pepe Mcfly", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );

  // Character 6: Smokin' Kek
  await kekTrumps.addCharacter(
    6, // characterId
    "Smokin' Kek", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );

  // Character 7: Pagan of Kekistan
  await kekTrumps.addCharacter(
    7, // characterId
    "Pagan of Kekistan", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );

  // Character 8: Kekurai kek
  await kekTrumps.addCharacter(
    8, // characterId
    "Kekurai kek", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );

  // Character 9: Sick Pepe
  await kekTrumps.addCharacter(
    9, // characterId
    "Sick Pepe", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );

  // Character 10: Keksplorer
  await kekTrumps.addCharacter(
    10, // characterId
    "Keksplorer", // name
    30, // bronzeSupply
    20, // silverSupply
    15, // goldSupply
    4 // greenSupply
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
