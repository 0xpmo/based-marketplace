// contracts/test/deploy.ignition.test.ts
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
  PepeCollectionFactory,
  PepeMarketplace,
  PepeNFTCollection,
} from "../typechain-types";

describe("PepeMarketplace Ignition Deployment", function () {
  it("Should deploy the contracts correctly via Ignition", async function () {
    // Get the deployment module
    const module = await import("../ignition/modules/deploy");

    // Deploy the contracts using Ignition
    const result = await hre.ignition.deploy(module.default);

    // Access the deployed contracts
    const factory = result.factory as unknown as PepeCollectionFactory;
    const marketplace = result.marketplace as unknown as PepeMarketplace;

    // Verify the factory was deployed correctly
    expect(await factory.getAddress()).to.be.properAddress;
    expect(await factory.creationFee()).to.equal(ethers.parseEther("0.01"));

    // Verify the marketplace was deployed correctly
    expect(await marketplace.getAddress()).to.be.properAddress;
    expect(await marketplace.marketFee()).to.equal(250); // 2.5%

    // Verify the sample collection was created
    expect(await factory.getCollectionCount()).to.equal(1);

    const collections = await factory.getCollections();
    expect(collections.length).to.equal(1);

    // Get the sample collection address
    const sampleCollectionAddress = collections[0];

    // Attach to the sample collection contract
    const PepeNFTCollectionFactory = await ethers.getContractFactory(
      "PepeNFTCollection"
    );
    const sampleCollection = PepeNFTCollectionFactory.attach(
      sampleCollectionAddress
    ) as unknown as PepeNFTCollection;

    // Verify sample collection properties
    expect(await sampleCollection.name()).to.equal("Pepe Originals");
    expect(await sampleCollection.symbol()).to.equal("PEPE");
    expect(await sampleCollection.collectionURI()).to.equal(
      "ipfs://QmQ4Uo5UkJEYLBTJk8tjrn29e6T9Cc1W3qZpcK1amt4xyi"
    );
    expect(await sampleCollection.mintPrice()).to.equal(
      ethers.parseEther("0.05")
    );
    expect(await sampleCollection.maxSupply()).to.equal(100);
    expect(await sampleCollection.royaltyFee()).to.equal(500);
  });
});
