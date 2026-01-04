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
            # Use /api/auth/login to match frontend behavior (endpoint includes /api)
            response = self.api.post("/api/auth/login", data={
                "email": email,
                "password": password,
            })
            
            if not response:
                raise AuthenticationError("Invalid response from server")
            
            # Backend returns { accessToken, refreshToken, user }
            # Check for both 'token' and 'accessToken' for compatibility
            self.token = response.get("accessToken") or response.get("token")
            self.current_user = response.get("user")
            
            if not self.token:
                logger.error(f"No token in response: {response.keys()}")
                raise AuthenticationError("No token received from server")
            
            if not self.current_user:
                logger.error(f"No user in response: {response.keys()}")
                raise AuthenticationError("No user data received from server")
            
            # Set token in API client
            self.api.set_token(self.token)
            
            # Store refresh token if provided
            refresh_token = response.get("refreshToken")
            if refresh_token:
                # Could store in config or memory for future use
                pass
            
            # Save authentication data for next session
            if self.token and self.current_user:
                save_auth_data(self.token, self.current_user)
                logger.info("Authentication data saved")
            
            logger.info(f"User logged in: {email}, token received: {bool(self.token)}")
            return {
                "success": True,
                "user": self.current_user,
                "token": self.token,
            }
        
        except AuthenticationError:
            raise
        except APIError as e:
            # Re-raise API errors (including 429) as-is
            raise
        except Exception as e:
            logger.error(f"Login error: {e}", exc_info=True)
            raise AuthenticationError(f"Login failed: {e}")
    
    def logout(self):
        """Logout user"""
        self.current_user = None
        self.token = None
        clear_auth_data()
        logger.info("User logged out")
    
    def load_saved_auth(self) -> bool:
        """Load saved authentication data"""
        auth_data = load_auth_data()
        if auth_data and auth_data.get("token") and auth_data.get("user"):
            self.token = auth_data["token"]
            self.current_user = auth_data["user"]
            self.api.set_token(self.token)
            logger.info(f"Loaded saved authentication for user: {self.current_user.get('email', 'Unknown')}")
            return True
        return False
    
    def is_token_valid(self) -> bool:
        """Check if current token is valid by making a test request"""
        if not self.token:
            return False
        
        try:
            # Try to get events list (requires authentication)
            response = self.api.get("/api/reference/events")
            if response is not None:
                # Token is valid, update saved data
                if self.current_user:
                    save_auth_data(self.token, self.current_user)
                return True
        except (AuthenticationError, APIError) as e:
            logger.debug(f"Token validation failed: {e}")
            # Clear invalid auth data
            clear_auth_data()
            self.current_user = None
            self.token = None
            return False
        except Exception as e:
            logger.debug(f"Token validation error: {e}")
            return False
        
        return False
    
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

