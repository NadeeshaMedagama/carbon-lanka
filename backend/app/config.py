from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./carbonlanka.db"
    carbon_price_min: float = 8.0
    carbon_price_max: float = 15.0
    usd_to_lkr: float = 310.0

    gee_service_account_key: str = ""
    gee_project_id: str = ""

    polygon_amoy_rpc: str = "https://rpc-amoy.polygon.technology"
    carbon_credit_contract_address: str = ""
    deployer_private_key: str = ""
    use_real_blockchain: bool = False

    @property
    def block_explorer_base_url(self) -> str:
        return "https://amoy.polygonscan.com"


settings = Settings()
