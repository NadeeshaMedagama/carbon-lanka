require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const RAW_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const DEPLOYER_KEY = RAW_KEY.length >= 64 ? RAW_KEY : "";
const AMOY_RPC = process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology";
const POLYGONSCAN_KEY = process.env.POLYGONSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    amoy: {
      url: AMOY_RPC,
      ...(DEPLOYER_KEY ? { accounts: [DEPLOYER_KEY] } : {}),
      chainId: 80002,
      gasPrice: 30000000000,
    },
    polygon: {
      url: process.env.POLYGON_MAINNET_RPC || "https://polygon-rpc.com",
      ...(DEPLOYER_KEY ? { accounts: [DEPLOYER_KEY] } : {}),
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: POLYGONSCAN_KEY,
      polygon: POLYGONSCAN_KEY,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
