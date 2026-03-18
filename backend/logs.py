# logs.py
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def log(level, message):
    """简单的日志函数"""
    logger = logging.getLogger(__name__)
    if level.lower().startswith('debug'):
        logger.debug(message)
    elif level.lower().startswith('info'):
        logger.info(message)
    elif level.lower().startswith('warn'):
        logger.warning(message)
    elif level.lower().startswith('error'):
        logger.error(message)
    else:
        logger.info(message)
