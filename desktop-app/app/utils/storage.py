"""Storage utilities for persisting data"""
import json
import os
from pathlib import Path
from typing import Optional, Dict, Any
from app.utils.logger import logger


class Storage:
    """Simple file-based storage"""
    
    def __init__(self, filename: str = "app_data.json"):
        """Initialize storage"""
        self.data_dir = Path.home() / ".local" / "share" / "ftr_registration"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.file_path = self.data_dir / filename
    
    def save(self, data: Dict[str, Any]) -> bool:
        """Save data to file"""
        try:
            with open(self.file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Error saving data: {e}")
            return False
    
    def load(self) -> Dict[str, Any]:
        """Load data from file"""
        try:
            if not self.file_path.exists():
                return {}
            
            with open(self.file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading data: {e}")
            return {}
    
    def clear(self) -> bool:
        """Clear stored data"""
        try:
            if self.file_path.exists():
                self.file_path.unlink()
            return True
        except Exception as e:
            logger.error(f"Error clearing data: {e}")
            return False


# Global storage instance
_storage = Storage()


def save_auth_data(token: str, user: Dict[str, Any]) -> bool:
    """Save authentication data"""
    return _storage.save({
        "auth": {
            "token": token,
            "user": user,
        }
    })


def load_auth_data() -> Optional[Dict[str, Any]]:
    """Load authentication data"""
    data = _storage.load()
    return data.get("auth")


def clear_auth_data() -> bool:
    """Clear authentication data"""
    data = _storage.load()
    if "auth" in data:
        del data["auth"]
        return _storage.save(data)
    return True


def save_display_settings(settings: Dict[str, Any]) -> bool:
    """Save display settings"""
    data = _storage.load()
    data["display_settings"] = settings
    return _storage.save(data)


def load_display_settings() -> Dict[str, Any]:
    """Load display settings"""
    data = _storage.load()
    return data.get("display_settings", {
        "registration_columns": {
            "number": True,
            "collective": True,
            "dance_name": True,
            "status": True,
            "payment_status": True,
            "participants_count": False,
            "notes": False,
        }
    })

