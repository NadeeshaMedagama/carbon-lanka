"""
Blockchain Service — Server-Side Polygon Interaction
======================================================
Wraps web3.py to provide async-safe minting, on-chain reads,
and transaction receipt verification for the CarbonCredit ERC-1155
contract on Polygon Amoy (testnet) or Polygon PoS (mainnet).

Security features:
  - Thread-safe nonce management via asyncio.Lock (prevents TOCTOU race)
  - EIP-1559 gas pricing (maxFeePerGas / maxPriorityFeePerGas)
  - POA middleware for Polygon's proof-of-authority sidechain
  - Receipt status validation before event parsing
  - All blocking web3 calls wrapped in asyncio.to_thread

Reference:
  Polygon PoS documentation: https://docs.polygon.technology/pos/
  web3.py docs: https://web3py.readthedocs.io/
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

logger = logging.getLogger(__name__)

_ABI_PATH = Path(__file__).parent.parent / "data" / "CarbonCredit.abi.json"


class BlockchainService:
    """Async-safe wrapper around web3.py for server-side contract interaction."""

    def __init__(
        self,
        rpc_url: str,
        private_key: str,
        contract_address: str,
    ) -> None:
        self.w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
        self.w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        self.account = self.w3.eth.account.from_key(private_key)
        abi = json.loads(_ABI_PATH.read_text())
        self.contract = self.w3.eth.contract(
            address=Web3.to_checksum_address(contract_address),
            abi=abi,
        )

        self._nonce_lock = asyncio.Lock()
        self._nonce: int | None = None

        logger.info(
            "BlockchainService initialised — verifier=%s contract=%s",
            self.account.address,
            contract_address,
        )

    # ── Nonce Management ──────────────────────────────────────────────────

    async def _get_nonce(self) -> int:
        """Return the next nonce, tracked locally to avoid TOCTOU races."""
        async with self._nonce_lock:
            if self._nonce is None:
                self._nonce = await asyncio.to_thread(
                    self.w3.eth.get_transaction_count,
                    self.account.address,
                    "pending",
                )
            else:
                self._nonce += 1
            return self._nonce

    async def _reset_nonce(self) -> None:
        """Reset local nonce counter (call after a tx failure)."""
        async with self._nonce_lock:
            self._nonce = None

    # ── Minting ───────────────────────────────────────────────────────────

    async def mint(
        self,
        farmer_address: str,
        tonnes: int,
        farm_id: str,
        vintage: str,
        sat_hash_bytes: bytes,
    ) -> dict[str, Any]:
        """
        Mint a CarbonCredit ERC-1155 token on-chain.

        Returns dict with token_id, tx_hash, and block_number.
        Raises RuntimeError on reverted transaction.
        """
        nonce = await self._get_nonce()
        try:
            result = await asyncio.to_thread(
                self._mint_sync,
                farmer_address,
                tonnes,
                farm_id,
                vintage,
                sat_hash_bytes,
                nonce,
            )
            return result
        except Exception:
            await self._reset_nonce()
            raise

    def _mint_sync(
        self,
        farmer_address: str,
        tonnes: int,
        farm_id: str,
        vintage: str,
        sat_hash_bytes: bytes,
        nonce: int,
    ) -> dict[str, Any]:
        """Synchronous mint — runs inside asyncio.to_thread."""
        tx = self.contract.functions.mint(
            Web3.to_checksum_address(farmer_address),
            tonnes,
            farm_id,
            vintage,
            sat_hash_bytes,
        ).build_transaction(
            {
                "from": self.account.address,
                "nonce": nonce,
                "gas": 350_000,
                "maxFeePerGas": self.w3.to_wei("35", "gwei"),
                "maxPriorityFeePerGas": self.w3.to_wei("30", "gwei"),
            }
        )

        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        if receipt.status != 1:
            raise RuntimeError(
                f"Mint transaction reverted: {tx_hash.hex()} "
                f"(gas used: {receipt.gasUsed})"
            )

        logs = self.contract.events.CreditMinted().process_receipt(receipt)
        if not logs:
            raise RuntimeError(
                f"Mint succeeded but no CreditMinted event found in tx {tx_hash.hex()}"
            )

        event_args = logs[0]["args"]
        token_id = event_args["tokenId"]

        logger.info(
            "Minted token #%d (%d tonnes) for %s — tx %s",
            token_id,
            tonnes,
            farmer_address,
            tx_hash.hex(),
        )

        return {
            "token_id": token_id,
            "tx_hash": tx_hash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
        }

    # ── Retirement Verification ───────────────────────────────────────────

    async def verify_retirement(
        self, tx_hash: str, expected_token_id: int
    ) -> dict[str, Any]:
        """
        Verify that a retire() transaction actually happened on-chain.

        Reads the transaction receipt, confirms status=1, and checks
        for a CreditRetired event matching the expected token ID.
        Raises ValueError if verification fails.
        """
        return await asyncio.to_thread(
            self._verify_retirement_sync, tx_hash, expected_token_id
        )

    def _verify_retirement_sync(
        self, tx_hash: str, expected_token_id: int
    ) -> dict[str, Any]:
        receipt = self.w3.eth.get_transaction_receipt(tx_hash)

        if receipt.status != 1:
            raise ValueError(f"Retirement transaction reverted: {tx_hash}")

        logs = self.contract.events.CreditRetired().process_receipt(receipt)
        for log in logs:
            args = log["args"]
            if args["tokenId"] == expected_token_id:
                return {
                    "token_id": args["tokenId"],
                    "retired_by": args["retiredBy"],
                    "amount": args["tonnes"],
                    "farm_id": args["farmId"],
                    "block_timestamp": args["timestamp"],
                    "block_number": receipt.blockNumber,
                }

        raise ValueError(
            f"No CreditRetired event for token #{expected_token_id} in tx {tx_hash}"
        )

    # ── On-Chain Reads ────────────────────────────────────────────────────

    async def get_credit(self, token_id: int) -> dict[str, Any]:
        """Read credit metadata directly from the contract."""
        return await asyncio.to_thread(self._get_credit_sync, token_id)

    def _get_credit_sync(self, token_id: int) -> dict[str, Any]:
        credit = self.contract.functions.getCredit(token_id).call()
        return {
            "farmer": credit[0],
            "tonnes": credit[1],
            "farm_id": credit[2],
            "vintage": credit[3],
            "methodology": credit[4],
            "sat_hash": "0x" + credit[5].hex(),
            "retired": credit[6],
            "retired_by": credit[7],
            "retired_at": credit[8],
        }

    async def get_balance(self, owner: str, token_id: int) -> int:
        """Read token balance for an address."""
        return await asyncio.to_thread(
            self.contract.functions.balanceOf(
                Web3.to_checksum_address(owner), token_id
            ).call
        )

    async def get_total_minted(self) -> int:
        return await asyncio.to_thread(
            self.contract.functions.totalMinted().call
        )

    async def is_retired(self, token_id: int) -> bool:
        return await asyncio.to_thread(
            self.contract.functions.isRetired(token_id).call
        )

    # ── Health Check ──────────────────────────────────────────────────────

    async def check_connection(self) -> dict[str, Any]:
        """Test RPC connectivity and return chain info."""
        def _check():
            connected = self.w3.is_connected()
            chain_id = self.w3.eth.chain_id if connected else None
            balance = (
                self.w3.eth.get_balance(self.account.address) if connected else 0
            )
            return {
                "connected": connected,
                "chain_id": chain_id,
                "verifier_address": self.account.address,
                "verifier_balance_wei": balance,
                "verifier_balance_pol": float(
                    self.w3.from_wei(balance, "ether")
                )
                if connected
                else 0.0,
                "contract_address": self.contract.address,
            }

        return await asyncio.to_thread(_check)


# ── Singleton ─────────────────────────────────────────────────────────────

_service: BlockchainService | None = None


def get_blockchain_service() -> BlockchainService | None:
    """Return the singleton BlockchainService, or None if blockchain is disabled."""
    return _service


def init_blockchain_service(
    rpc_url: str,
    private_key: str,
    contract_address: str,
) -> BlockchainService:
    """Initialise the singleton. Called once at app startup."""
    global _service
    _service = BlockchainService(rpc_url, private_key, contract_address)
    return _service
