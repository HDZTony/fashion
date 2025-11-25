"""启动脚本，配置 uvicorn 忽略 .venv 目录"""
import uvicorn
import os
from pathlib import Path

if __name__ == "__main__":
    # 获取当前目录
    current_dir = Path(__file__).parent
    
    # 设置环境变量，让 watchfiles 忽略 .venv 目录
    os.environ.setdefault("WATCHFILES_IGNORE_PATTERNS", ".venv,__pycache__,*.pyc")
    
    # 配置 uvicorn，只监控当前目录
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=[str(current_dir)],
    )

