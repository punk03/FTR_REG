"""Logging configuration"""
import sys
from pathlib import Path
from loguru import logger
from app.utils.config import get_log_dir, settings

# Create log directory
log_dir = get_log_dir()
log_dir.mkdir(parents=True, exist_ok=True)

# Remove default handler
logger.remove()

# Add console handler
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level=settings.log_level,
    colorize=True,
)

# Add file handler
logger.add(
    log_dir / "app.log",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
    level=settings.log_level,
    rotation="10 MB",
    retention="7 days",
    compression="zip",
)

# Export logger
__all__ = ["logger"]

