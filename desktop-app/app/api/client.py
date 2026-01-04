"""API client for server communication"""
import requests
from typing import Optional, Dict, Any, List
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from app.utils.config import settings
from app.utils.logger import logger


class APIClient:
    """API client for communicating with the server"""
    
    def __init__(self, base_url: Optional[str] = None, token: Optional[str] = None):
        self.base_url = base_url or settings.api_base_url
        self.token = token
        self.session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set default headers
        self.session.headers.update({
            "Content-Type": "application/json",
        })
        
        if self.token:
            self.set_token(self.token)
    
    def set_token(self, token: str):
        """Set authentication token"""
        self.token = token
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
        })
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        files: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Make HTTP request"""
        # Frontend uses endpoints like '/api/auth/login' with empty baseURL
        # We need to handle baseURL that may or may not include /api
        # If baseURL ends with /api and endpoint starts with /api, remove duplicate
        
        endpoint = endpoint if endpoint.startswith('/') else f'/{endpoint}'
        
        # Remove /api from baseURL if endpoint already includes it
        base_url = self.base_url.rstrip('/')
        if base_url.endswith('/api') and endpoint.startswith('/api'):
            # Remove /api from baseURL to avoid duplication
            base_url = base_url[:-4]  # Remove '/api'
        
        url = f"{base_url}{endpoint}"
        
        try:
            kwargs = {
                "timeout": settings.api_timeout,
            }
            
            if params:
                kwargs["params"] = params
            
            if files:
                kwargs["files"] = files
                kwargs["data"] = data
            elif data:
                kwargs["json"] = data
            
            response = self.session.request(method, url, **kwargs)
            
            # Handle rate limiting (429) before raise_for_status
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "60")
                try:
                    retry_after_seconds = int(retry_after)
                except ValueError:
                    retry_after_seconds = 60
                
                error_msg = f"Слишком много запросов. Попробуйте через {retry_after_seconds} секунд."
                raise APIError(error_msg, status_code=429, retry_after=retry_after_seconds)
            
            response.raise_for_status()
            
            # Handle empty responses
            if response.status_code == 204 or not response.content:
                return None
            
            return response.json()
        
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error: {e}")
            raise APIError(f"Cannot connect to server: {e}")
        
        except requests.exceptions.Timeout as e:
            logger.error(f"Request timeout: {e}")
            raise TimeoutError(f"Request timeout: {e}")
        
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            if hasattr(e.response, 'status_code') and e.response.status_code == 401:
                raise AuthenticationError("Authentication failed")
            raise APIError(f"HTTP error: {e}")
        
        except APIError:
            # Re-raise APIError as-is
            raise
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise APIError(f"Unexpected error: {e}")
    
    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """GET request"""
        return self._request("GET", endpoint, params=params)
    
    def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None, files: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """POST request"""
        return self._request("POST", endpoint, data=data, files=files)
    
    def put(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """PUT request"""
        return self._request("PUT", endpoint, data=data)
    
    def patch(self, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """PATCH request"""
        return self._request("PATCH", endpoint, data=data)
    
    def delete(self, endpoint: str) -> Optional[Dict[str, Any]]:
        """DELETE request"""
        return self._request("DELETE", endpoint)
    
    def check_connection(self) -> bool:
        """Check if server is reachable"""
        try:
            response = self.get("/health")
            return response is not None
        except Exception:
            return False


class AuthenticationError(Exception):
    """Authentication error"""
    pass


class APIError(Exception):
    """API error"""
    def __init__(self, message: str, status_code: Optional[int] = None, retry_after: Optional[int] = None):
        self.message = message
        self.status_code = status_code
        self.retry_after = retry_after
        super().__init__(self.message)

