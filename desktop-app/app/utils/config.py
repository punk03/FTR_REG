"""Configuration management"""
import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables
load_dotenv()


class Settings(BaseSettings):
    """Application settings"""
    
    # API Configuration
    api_base_url: str = "http://localhost:5000/api"
    api_timeout: int = 30
    
    # Sync Configuration
    sync_interval: int = 60  # seconds
    auto_sync: bool = True
    
    # Database Configuration
    db_path: str = "./data/ftr_registration.db"
    
    # Logging
    log_level: str = "INFO"
    log_file: str = "./logs/app.log"
    
    # Application
    app_name: str = "FTR Registration"
    app_version: str = "1.0.0"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()


def get_data_dir() -> Path:
    """Get application data directory"""
    if os.name == "nt":  # Windows
        base = Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif os.name == "posix":  # macOS/Linux
        base = Path.home() / ".local" / "share"
    else:
        base = Path.home()
    
    data_dir = base / "ftr_registration"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def get_db_path() -> Path:
    """Get database path"""
    if settings.db_path.startswith("./"):
        # Relative path - use data directory
        return get_data_dir() / settings.db_path[2:]
    return Path(settings.db_path)


def get_log_dir() -> Path:
    """Get log directory"""
    log_file = Path(settings.log_file)
    if log_file.is_absolute():
        return log_file.parent
    return get_data_dir() / "logs"

