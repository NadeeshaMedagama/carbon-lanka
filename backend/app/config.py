from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./carbonlanka.db"

    # ── Carbon market pricing ─────────────────────────────────────────────────
    carbon_price_min: float = 8.0    # USD per tonne CO2
    carbon_price_max: float = 15.0   # USD per tonne CO2
    usd_to_lkr: float = 310.0

    # ── Platform fees and Verra pooling ──────────────────────────────────────
    platform_fee_rate: float = 0.06          # 6% transaction fee on gross sale
    total_mrv_verification_cost_usd: float = 40_000.0   # shared Verra audit cost (pool level)
    mrv_cost_per_token_usd: float = 75.0     # MRV cost deducted per individual token sale
    verra_minimum_tonnes: float = 10_000.0   # Verra VMD0042 minimum pool size

    # ── Solar estimation ──────────────────────────────────────────────────────
    solar_default_kw_per_ha: float = 500.0   # fallback when solar_kw_installed not provided

    # ── Blockchain / explorer ────────────────────────────────────────────────
    polygon_amoy_rpc: str = "https://rpc-amoy.polygon.technology"
    carbon_credit_contract_address: str = ""
    deployer_private_key: str = ""
    # Set USE_REAL_BLOCKCHAIN=false in .env to force simulation even when keys are present
    use_real_blockchain_override: bool | None = None

    @property
    def use_real_blockchain(self) -> bool:
        """Auto-enable when both private key and contract address are properly set.
        Override with USE_REAL_BLOCKCHAIN=true/false in .env."""
        if self.use_real_blockchain_override is not None:
            return self.use_real_blockchain_override
        key = self.deployer_private_key.strip()
        addr = self.carbon_credit_contract_address.strip()
        key_valid = len(key) >= 64 and not key.startswith("0xYOUR")
        addr_valid = len(addr) == 42 and addr.startswith("0x")
        return key_valid and addr_valid

    @property
    def block_explorer_base_url(self) -> str:
        return "https://amoy.polygonscan.com/tx"

    # ── Google Earth Engine ───────────────────────────────────────────────────
    gee_service_account_key: str = ""
    gee_project_id: str = ""

    # ── Admin ─────────────────────────────────────────────────────────────────
    admin_secret_key: str = "carbonlanka-admin"


settings = Settings()
