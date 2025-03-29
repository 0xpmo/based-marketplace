// contracts/hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition";
import * as dotenv from "dotenv";
import "@openzeppelin/hardhat-upgrades";

dotenv.config();

const PRIVATE_KEY =
  process.env.BASED_AI_MAINNET_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const BASED_AI_RPC_URL =
  process.env.BASED_AI_MAINNET_RPC_URL ||
  "https://mainnet.basedaibridge.com/rpc/";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR-based compilation
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    basedai: {
      url: BASED_AI_RPC_URL,
      chainId: 32323,
      accounts: [PRIVATE_KEY],
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
    ignition: "./ignition",
  },
  ignition: {},
};

export default config;
