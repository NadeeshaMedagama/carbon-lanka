const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CarbonCredit", function () {
  let contract, owner, verifier, farmer, buyer;

  const FARM_ID = "FARM-NE-001";
  const VINTAGE = "2026";
  const TONNES = 180;
  const SAT_HASH = ethers.keccak256(ethers.toUtf8Bytes("ndvi:tea_organic:0.74"));

  beforeEach(async function () {
    [owner, verifier, farmer, buyer] = await ethers.getSigners();
    const CarbonCredit = await ethers.getContractFactory("CarbonCredit");
    contract = await CarbonCredit.deploy(owner.address);
    await contract.waitForDeployment();

    // Grant verifier role
    await contract.addVerifier(verifier.address);
  });

  // ── Deployment ──────────────────────────────────────────────────────────

  it("sets correct admin", async function () {
    const ADMIN_ROLE = await contract.ADMIN_ROLE();
    expect(await contract.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
  });

  it("owner has verifier role by default", async function () {
    const VERIFIER_ROLE = await contract.VERIFIER_ROLE();
    expect(await contract.hasRole(VERIFIER_ROLE, owner.address)).to.be.true;
  });

  // ── Minting ─────────────────────────────────────────────────────────────

  it("verifier can mint a credit", async function () {
    const tx = await contract.connect(verifier).mint(
      farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH
    );
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });

  it("emits CreditMinted event on mint", async function () {
    await expect(
      contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH)
    )
      .to.emit(contract, "CreditMinted")
      .withArgs(1, farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
  });

  it("farmer receives correct token balance after mint", async function () {
    await contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
    const balance = await contract.balanceOf(farmer.address, 1);
    expect(balance).to.equal(TONNES);
  });

  it("credit data is stored correctly", async function () {
    await contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
    const credit = await contract.getCredit(1);
    expect(credit.farmer).to.equal(farmer.address);
    expect(credit.tonnes).to.equal(TONNES);
    expect(credit.farmId).to.equal(FARM_ID);
    expect(credit.vintage).to.equal(VINTAGE);
    expect(credit.satHash).to.equal(SAT_HASH);
    expect(credit.retired).to.be.false;
  });

  it("non-verifier cannot mint", async function () {
    await expect(
      contract.connect(buyer).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH)
    ).to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
  });

  it("rejects zero tonnes", async function () {
    await expect(
      contract.connect(verifier).mint(farmer.address, 0, FARM_ID, VINTAGE, SAT_HASH)
    ).to.be.revertedWith("Tonnes must be > 0");
  });

  it("totalMinted increments", async function () {
    await contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
    await contract.connect(verifier).mint(farmer.address, 50, "FARM-RP-002", VINTAGE, SAT_HASH);
    expect(await contract.totalMinted()).to.equal(2);
  });

  // ── Retirement ───────────────────────────────────────────────────────────

  it("buyer can retire credit after receiving it", async function () {
    await contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
    // Transfer to buyer
    await contract.connect(farmer).safeTransferFrom(
      farmer.address, buyer.address, 1, TONNES, "0x"
    );
    await expect(contract.connect(buyer).retire(1, TONNES))
      .to.emit(contract, "CreditRetired")
      .withArgs(1, buyer.address, TONNES, FARM_ID, await getBlockTimestamp(contract));
  });

  it("retired token balance becomes zero", async function () {
    await contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
    await contract.connect(farmer).retire(1, TONNES);
    expect(await contract.balanceOf(farmer.address, 1)).to.equal(0);
  });

  it("isRetired returns true after retirement", async function () {
    await contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
    await contract.connect(farmer).retire(1, TONNES);
    expect(await contract.isRetired(1)).to.be.true;
  });

  it("cannot retire twice", async function () {
    await contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
    await contract.connect(farmer).retire(1, TONNES);
    await expect(contract.connect(farmer).retire(1, TONNES))
      .to.be.revertedWith("Already fully retired");
  });

  it("cannot retire without balance", async function () {
    await contract.connect(verifier).mint(farmer.address, TONNES, FARM_ID, VINTAGE, SAT_HASH);
    await expect(contract.connect(buyer).retire(1, TONNES))
      .to.be.revertedWith("Insufficient balance");
  });
});

async function getBlockTimestamp(contract) {
  // Helper — returns the latest block timestamp for event matching
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}
