const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying CarbonCredit to", network.name, "...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC\n");

  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const contract = await CarbonCredit.deploy(deployer.address);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("CarbonCredit deployed to:", address);
  console.log("\nAdd to .env:");
  console.log(`CARBON_CREDIT_CONTRACT_ADDRESS=${address}`);
  console.log(`VITE_CONTRACT_ADDRESS=${address}`);

  if (network.name !== "localhost") {
    console.log("\nBlock explorer:");
    const explorer = network.name === "mumbai"
      ? `https://mumbai.polygonscan.com/address/${address}`
      : `https://polygonscan.com/address/${address}`;
    console.log(explorer);

    console.log("\nVerify with:");
    console.log(`npx hardhat verify --network ${network.name} ${address} ${deployer.address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
