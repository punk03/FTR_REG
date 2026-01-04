"""Authentication service"""
from typing import Optional, Dict, Any
from app.api.client import APIClient, AuthenticationError
from app.utils.logger import logger
from app.utils.config import settings


class AuthService:
    """Service for handling authentication"""
    
    def __init__(self, api_client: APIClient):
        self.api = api_client
        self.current_user: Optional[Dict[str, Any]] = None
        self.token: Optional[str] = None
    
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """Login user"""
        try:
            # Use /auth/login (without /api) since baseURL already includes /api
            response = self.api.post("/auth/login", data={
                "email": email,
                "password": password,
            })
            
            if not response:
                raise AuthenticationError("Invalid response from server")
            
            self.token = response.get("token")
            self.current_user = response.get("user")
            
            if self.token:
                self.api.set_token(self.token)
            
            logger.info(f"User logged in: {email}")
            return {
                "success": True,
                "user": self.current_user,
                "token": self.token,
            }
        
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Login error: {e}")
            raise AuthenticationError(f"Login failed: {e}")
    
    def logout(self):
        """Logout user"""
        self.current_user = None
        self.token = None
        logger.info("User logged out")
    
    def is_authenticated(self) -> bool:
        """Check if user is authenticated"""
        return self.token is not None and self.current_user is not None
    
    def enable_offline_mode(self):
        """Enable offline mode without authentication"""
        # Set a dummy user for offline mode
        self.current_user = {
            "id": 0,
            "name": "Оффлайн режим",
            "email": "offline@local",
            "role": "REGISTRATOR"
        }
        self.token = None
        logger.info("Offline mode enabled")
    
    def get_user(self) -> Optional[Dict[str, Any]]:
        """Get current user"""
        return self.current_user
    
    def set_token(self, token: str):
        """Set authentication token"""
        self.token = token
        self.api.set_token(token)

