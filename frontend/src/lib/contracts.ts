import { ethers } from "ethers";
import { MARKETPLACE_ADDRESS } from "@/constants/addresses";
import { getDefaultProvider } from "./web3";
// import { MarketplaceABI } from "@/contracts/abis/MarketplaceABI";
// import { CollectionABI } from "@/contracts/abis/CollectionABI";
import CollectionABI from "@/contracts/BasedSeaSequentialNFTCollection.json";
import MarketplaceABI from "@/contracts/BasedSeaMarketplace.json";
import KekTrumpsABI from "@/contracts/KekTrumps.json";

// Get provider
export const getProvider = async () => {
  return getDefaultProvider();
};

// Get NFT contract by address
export const getNFTContractByAddress = async (address: string) => {
  const provider = await getProvider();
  return new ethers.Contract(address, CollectionABI.abi, provider);
};

// Get NFT contract with signer
export const getNFTContractWithSigner = async (address: string) => {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  return new ethers.Contract(address, CollectionABI.abi, signer);
};

export const setCollectionApproval = async (
  collectionAddress: string,
  approved: boolean = true
) => {
  try {
    const nftContract = await getNFTContractWithSigner(collectionAddress);
    const tx = await nftContract.setApprovalForAll(
      MARKETPLACE_ADDRESS,
      approved
    );
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error setting collection approval:", error);
    throw error;
  }
};

// Get ERC1155 contract with signer
export const getERC1155ContractWithSigner = async (address: string) => {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  return new ethers.Contract(address, KekTrumpsABI.abi, signer);
};

// Get marketplace contract
export const getMarketplaceContract = async () => {
  try {
    console.log(`Using Marketplace Address: ${MARKETPLACE_ADDRESS}`);
    const provider = await getProvider();
    const signer = await provider.getSigner();
    return new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);
  } catch (error) {
    console.error("Error getting marketplace contract with signer:", error);
    throw error;
  }
};

// Get marketplace contract (read-only)
export const getMarketplaceContractReadOnly = async () => {
  try {
    console.log(
      `Using Marketplace Address (read-only): ${MARKETPLACE_ADDRESS}`
    );
    const provider = await getProvider();
    return new ethers.Contract(
      MARKETPLACE_ADDRESS,
      MarketplaceABI.abi,
      provider
    );
  } catch (error) {
    console.error("Error getting read-only marketplace contract:", error);
    throw error;
  }
};
