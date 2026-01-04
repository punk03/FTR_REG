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
        # Frontend uses endpoints like '/api/auth/login' with empty or relative baseURL
        # We use baseURL='http://host:port/api', so endpoints should NOT include /api
        # If endpoint starts with /api, it means it's already the full path, use as-is
        # Otherwise, construct URL normally
        
        if endpoint.startswith('/api'):
            # Endpoint already includes /api, use it directly with baseURL
            # This matches frontend behavior where endpoint='/api/auth/login'
            url = f"{self.base_url.rstrip('/')}{endpoint}"
        else:
            # Endpoint doesn't include /api, add it
            endpoint = endpoint if endpoint.startswith('/') else f'/{endpoint}'
            url = f"{self.base_url.rstrip('/')}{endpoint}"
        
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
            if response.status_code == 401:
                raise AuthenticationError("Authentication failed")
            raise APIError(f"HTTP error: {e}")
        
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
    pass

