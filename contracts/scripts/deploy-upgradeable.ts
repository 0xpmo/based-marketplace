import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying upgradeable BasedCollectionFactory...");

  const DEFAULT_FEE = ethers.parseEther("0.001"); // 0.001 ETH

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy the upgradeable contract
  const BasedCollectionFactory = await ethers.getContractFactory(
    "BasedCollectionFactory"
  );

  const proxy = await upgrades.deployProxy(
    BasedCollectionFactory,
    [DEFAULT_FEE, deployer.address],
    { initializer: "initialize" }
  );

  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  console.log("BasedCollectionFactory proxy deployed to:", proxyAddress);

  // Get the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log(
    "BasedCollectionFactory implementation deployed to:",
    implementationAddress
  );

  // Get the admin address
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
  console.log("ProxyAdmin deployed to:", adminAddress);

  console.log("Deployment completed successfully");
}

// We recommend this pattern to be able to use async/await everywhere
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
