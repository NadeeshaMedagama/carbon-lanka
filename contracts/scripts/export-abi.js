/**
 * Extract the ABI from Hardhat compilation artifacts and write it
 * to the backend data directory for use by the BlockchainService.
 *
 * Usage:
 *   npx hardhat compile
 *   node scripts/export-abi.js
 */
const fs = require("fs");
const path = require("path");

const ARTIFACT_PATH = path.join(
  __dirname,
  "..",
  "artifacts",
  "contracts",
  "CarbonCredit.sol",
  "CarbonCredit.json"
);

const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "..",
  "backend",
  "app",
  "data",
  "CarbonCredit.abi.json"
);

if (!fs.existsSync(ARTIFACT_PATH)) {
  console.error("Artifact not found. Run `npx hardhat compile` first.");
  console.error("Expected:", ARTIFACT_PATH);
  process.exit(1);
}

const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf-8"));
const abi = JSON.stringify(artifact.abi, null, 2);

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, abi);

console.log(`ABI exported (${artifact.abi.length} entries) -> ${OUTPUT_PATH}`);
