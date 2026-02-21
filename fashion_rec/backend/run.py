"""启动脚本，配置 uvicorn 忽略 .venv 目录"""
import uvicorn
import os
import sys
from pathlib import Path

if __name__ == "__main__":
    # 获取当前目录
    current_dir = Path(__file__).parent
    
    # 设置环境变量，让 watchfiles 忽略 .venv 目录
    os.environ.setdefault("WATCHFILES_IGNORE_PATTERNS", ".venv,__pycache__,*.pyc")
    
    # 确保 Python 输出不被缓冲（立即输出）
    os.environ["PYTHONUNBUFFERED"] = "1"
    
    # 配置 uvicorn，只监控当前目录
    # log_level="info" 确保日志输出
    # 增加超时设置以支持大图片上传和处理
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        reload_dirs=[str(current_dir)],
        log_level="info",  # 确保日志级别足够详细
        access_log=True,   # 启用访问日志
        timeout_keep_alive=300,  # 保持连接 5 分钟
        timeout_graceful_shutdown=30,  # 优雅关闭超时
    )

