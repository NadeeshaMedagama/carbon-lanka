// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CarbonCredit
 * @notice ERC-1155 Carbon Credit Token for CarbonLanka — Sri Lankan SME Carbon Marketplace
 *
 * Each token represents one verified tonne of CO2 sequestered or avoided
 * by a Sri Lankan smallholder farm, verified against IPCC Tier-2 methodology
 * and Sentinel-2 satellite data.
 *
 * Token lifecycle:
 *   1. Verifier mints token after AI-MRV + satellite verification
 *   2. Farmer lists on marketplace
 *   3. Buyer purchases and retires (burns) the token — permanent, irreversible
 *
 * Network: Polygon PoS (Mumbai testnet for MVP)
 * Standard: ERC-1155 (EIP-1155) — https://eips.ethereum.org/EIPS/eip-1155
 *
 * Reference:
 *   Toucan Protocol architecture: https://docs.toucan.earth/toucan/introduction/whitepaper
 *   WEF Blockchain for Carbon: https://www.weforum.org/reports/blockchain-for-scaling-voluntary-carbon-markets
 */

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

contract CarbonCredit is ERC1155, AccessControl, ERC1155Burnable, ERC1155Supply {
    // ── Roles ─────────────────────────────────────────────────────────────
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ── Credit data structure ─────────────────────────────────────────────
    struct Credit {
        address farmer;        // Farmer's wallet address
        uint256 tonnes;        // CO2 in kg (1 token = 1 tonne = 1000 kg stored as 1000)
        string farmId;         // Unique farm identifier (from CarbonLanka backend)
        string vintage;        // Year credit was generated (e.g. "2026")
        string methodology;    // "Verra VMD0042" or "IPCC Tier-2"
        bytes32 satHash;       // keccak256(Sentinel-2 NDVI export bytes)
        bool retired;          // true = permanently consumed as carbon offset
        address retiredBy;     // Buyer who retired the credit
        uint256 retiredAt;     // Block timestamp of retirement
    }

    // ── Storage ───────────────────────────────────────────────────────────
    mapping(uint256 => Credit) public credits;
    uint256 private _nextTokenId;

    // ── Events ────────────────────────────────────────────────────────────
    event CreditMinted(
        uint256 indexed tokenId,
        address indexed farmer,
        uint256 tonnes,
        string farmId,
        string vintage,
        bytes32 satHash
    );

    event CreditRetired(
        uint256 indexed tokenId,
        address indexed retiredBy,
        uint256 tonnes,
        string farmId,
        uint256 timestamp
    );

    // ── Constructor ───────────────────────────────────────────────────────
    constructor(address admin) ERC1155("https://api.carbonmicro.lk/credits/{id}.json") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _nextTokenId = 1;
    }

    // ── Mint ──────────────────────────────────────────────────────────────

    /**
     * @notice Mint a new carbon credit token for a verified farm.
     * @dev Only callable by VERIFIER_ROLE (CarbonLanka platform after AI-MRV + Verra confirmation).
     * @param farmer    Farmer's wallet address — receives the token
     * @param tonnes    Tonnes CO2 (1 token represents 1 tonne; pass integer tonnes)
     * @param farmId    Backend farm identifier string
     * @param vintage   Year credit was generated (e.g. "2026")
     * @param satHash   keccak256 hash of satellite verification export
     * @return tokenId  The minted ERC-1155 token ID
     */
    function mint(
        address farmer,
        uint256 tonnes,
        string memory farmId,
        string memory vintage,
        bytes32 satHash
    ) external onlyRole(VERIFIER_ROLE) returns (uint256 tokenId) {
        require(farmer != address(0), "Invalid farmer address");
        require(tonnes > 0, "Tonnes must be > 0");
        require(bytes(farmId).length > 0, "Empty farmId");

        tokenId = _nextTokenId++;

        credits[tokenId] = Credit({
            farmer: farmer,
            tonnes: tonnes,
            farmId: farmId,
            vintage: vintage,
            methodology: "Verra VMD0042",
            satHash: satHash,
            retired: false,
            retiredBy: address(0),
            retiredAt: 0
        });

        // Mint `tonnes` units of token `tokenId` to farmer
        // Each unit = 1 tonne of CO2
        _mint(farmer, tokenId, tonnes, "");

        emit CreditMinted(tokenId, farmer, tonnes, farmId, vintage, satHash);
    }

    // ── Retire ────────────────────────────────────────────────────────────

    /**
     * @notice Retire (permanently consume) a carbon credit as an offset.
     * @dev PERMANENT. IRREVERSIBLE. Token is burned on-chain.
     *      94% fraud reduction vs traditional registries (WEF 2023).
     * @param tokenId   The ERC-1155 token ID to retire
     * @param amount    Number of tonnes to retire (must be <= balance)
     */
    function retire(uint256 tokenId, uint256 amount) external {
        require(credits[tokenId].farmer != address(0), "Token does not exist");
        require(!credits[tokenId].retired, "Already fully retired");
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");

        credits[tokenId].retired = true;        // PERMANENT. Irreversible.
        credits[tokenId].retiredBy = msg.sender;
        credits[tokenId].retiredAt = block.timestamp;

        // Burn token — destroyed on-chain, cannot be re-used
        _burn(msg.sender, tokenId, amount);

        emit CreditRetired(
            tokenId,
            msg.sender,
            amount,
            credits[tokenId].farmId,
            block.timestamp
        );
    }

    // ── View functions ────────────────────────────────────────────────────

    function getCredit(uint256 tokenId) external view returns (Credit memory) {
        require(credits[tokenId].farmer != address(0), "Token does not exist");
        return credits[tokenId];
    }

    function isRetired(uint256 tokenId) external view returns (bool) {
        return credits[tokenId].retired;
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ── Admin ─────────────────────────────────────────────────────────────

    function addVerifier(address verifier) external onlyRole(ADMIN_ROLE) {
        _grantRole(VERIFIER_ROLE, verifier);
    }

    function removeVerifier(address verifier) external onlyRole(ADMIN_ROLE) {
        _revokeRole(VERIFIER_ROLE, verifier);
    }

    function setURI(string memory newuri) external onlyRole(ADMIN_ROLE) {
        _setURI(newuri);
    }

    // ── Required overrides ────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
