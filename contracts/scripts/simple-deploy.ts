import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Step 1: Deploy implementation
  const SimpleStorage = await ethers.getContractFactory(
    "SimpleStorageUpgradeable"
  );
  const implementation = await SimpleStorage.deploy({
    gasPrice: 9,
    gasLimit: 3000000,
  });
  await implementation.waitForDeployment();
  console.log("Implementation deployed to:", await implementation.getAddress());

  // Step 2: Deploy ERC1967Proxy
  // First, make sure to import this in your contracts folder
  const ERC1967Proxy = await ethers.getContractFactory("ERC1967Proxy");

  // Encode initialization data
  const data = SimpleStorage.interface.encodeFunctionData("initialize", []);

  const proxy = await ERC1967Proxy.deploy(
    await implementation.getAddress(),
    data,
    { gasPrice: 9, gasLimit: 3000000 }
  );

  await proxy.waitForDeployment();
  console.log("Proxy deployed to:", await proxy.getAddress());
}

main().catch(console.error);
