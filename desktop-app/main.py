"""Main entry point for the desktop application"""
import sys
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.database.session import init_db, get_db_session
from app.api.client import APIClient
from app.services.auth_service import AuthService
from app.gui.main_window import MainWindow
from app.utils.config import settings
from app.utils.logger import logger


def main():
    """Main function"""
    try:
        logger.info("Starting FTR Registration Desktop Application")
        logger.info(f"Version: {settings.app_version}")
        
        # Initialize database
        logger.info("Initializing database...")
        init_db()
        
        # Create API client
        api_client = APIClient()
        
        # Create auth service
        auth_service = AuthService(api_client)
        
        # Create and run GUI
        logger.info("Starting GUI...")
        app = MainWindow(auth_service)
        app.mainloop()
        
    except KeyboardInterrupt:
        logger.info("Application interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

