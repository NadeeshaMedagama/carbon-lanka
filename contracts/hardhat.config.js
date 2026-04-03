require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "0".repeat(64);
const MUMBAI_RPC = process.env.POLYGON_MUMBAI_RPC || "https://rpc-mumbai.maticvigil.com";
const POLYGONSCAN_KEY = process.env.POLYGONSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    mumbai: {
      url: MUMBAI_RPC,
      accounts: [DEPLOYER_KEY],
      chainId: 80001,
      gasPrice: 20000000000,
    },
    polygon: {
      url: process.env.POLYGON_MAINNET_RPC || "https://polygon-rpc.com",
      accounts: [DEPLOYER_KEY],
      chainId: 137,
    },
  },
  etherscan: {
    apiKey: {
      polygonMumbai: POLYGONSCAN_KEY,
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
