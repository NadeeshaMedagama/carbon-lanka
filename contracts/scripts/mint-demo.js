/**
 * Demo mint script for CryptX 2.0 hackathon presentation.
 * Mints a real token on Polygon Mumbai testnet from the tea farm demo case.
 *
 * Usage:
 *   npx hardhat run scripts/mint-demo.js --network mumbai
 */
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.CARBON_CREDIT_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error("Set CARBON_CREDIT_CONTRACT_ADDRESS in .env");
  }

  const [deployer] = await ethers.getSigners();
  const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
  const contract = CarbonCredit.attach(contractAddress);

  // Demo farm: 5 acres, Nuwara Eliya tea farm, 182 tonnes CO2
  const farmerAddress = deployer.address;  // use deployer as demo farmer
  const tonnes = 182;
  const farmId = "FARM-NE-001";
  const vintage = "2026";

  // Simulate satellite hash (keccak256 of NDVI export data)
  const satHash = ethers.keccak256(
    ethers.toUtf8Bytes(`NDVI:${farmId}:tea_organic:0.74:2026-03`)
  );

  console.log("Minting demo carbon credit...");
  console.log(`  Farm: ${farmId}`);
  console.log(`  Farmer: ${farmerAddress}`);
  console.log(`  Tonnes CO2: ${tonnes}`);
  console.log(`  Vintage: ${vintage}`);
  console.log(`  Satellite Hash: ${satHash}\n`);

  const tx = await contract.mint(farmerAddress, tonnes, farmId, vintage, satHash);
  const receipt = await tx.wait();

  // Parse CreditMinted event
  const event = receipt.logs
    .map(log => { try { return contract.interface.parseLog(log); } catch { return null; } })
    .find(e => e?.name === "CreditMinted");

  const tokenId = event?.args?.tokenId;

  console.log("Token minted!");
  console.log(`  Token ID: ${tokenId}`);
  console.log(`  Transaction: ${tx.hash}`);
  console.log(`  Block Explorer: https://mumbai.polygonscan.com/tx/${tx.hash}`);
  console.log(`\n  Open on screen during demo: https://mumbai.polygonscan.com/tx/${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
