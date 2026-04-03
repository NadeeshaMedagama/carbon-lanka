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
    polygon_block_explorer_url: str = "https://mumbai.polygonscan.com/tx"
    polygon_mumbai_rpc: str = "https://rpc-mumbai.maticvigil.com"
    carbon_credit_contract_address: str = ""
    deployer_private_key: str = ""
    use_real_blockchain: bool = False

    @property
    def block_explorer_base_url(self) -> str:
        return "https://amoy.polygonscan.com"

    # ── Google Earth Engine ───────────────────────────────────────────────────
    gee_service_account_key: str = ""
    gee_project_id: str = ""


settings = Settings()
