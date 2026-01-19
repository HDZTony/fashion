"""
凭据管理服务
用于加密/解密存储 Google Search Console OAuth 凭据
"""
import os
import json
from typing import Dict, Any, Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.backends import default_backend
import base64


class CredentialsManager:
    """管理 OAuth 凭据的加密存储和检索"""
    
    def __init__(self):
        # 从环境变量获取加密密钥
        # 如果不存在，使用默认密钥（仅用于开发，生产环境必须设置）
        encryption_key = os.getenv('CREDENTIALS_ENCRYPTION_KEY')
        if not encryption_key:
            # 开发环境默认密钥（生产环境必须设置环境变量）
            encryption_key = 'default-dev-key-change-in-production-32-chars!!'
            print("[CredentialsManager] WARNING: Using default encryption key. Set CREDENTIALS_ENCRYPTION_KEY in production!")
        
        # 确保密钥长度正确（Fernet 需要 32 字节的 base64 编码密钥）
        if len(encryption_key) < 32:
            # 如果密钥太短，使用 PBKDF2 派生
            kdf = PBKDF2(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'fashion_rec_salt',  # 固定 salt（生产环境应使用随机 salt）
                iterations=100000,
                backend=default_backend()
            )
            key = base64.urlsafe_b64encode(kdf.derive(encryption_key.encode()))
        else:
            # 如果密钥足够长，直接使用
            key = base64.urlsafe_b64encode(encryption_key[:32].encode().ljust(32, b'0'))
        
        self.cipher = Fernet(key)
    
    def encrypt_credentials(self, credentials_dict: Dict[str, Any]) -> str:
        """
        加密 OAuth 凭据
        
        Args:
            credentials_dict: OAuth 凭据字典
            
        Returns:
            加密后的 base64 编码字符串
        """
        # 将凭据转换为 JSON 字符串
        credentials_json = json.dumps(credentials_dict)
        
        # 加密
        encrypted = self.cipher.encrypt(credentials_json.encode('utf-8'))
        
        # 返回 base64 编码的加密数据
        return base64.urlsafe_b64encode(encrypted).decode('utf-8')
    
    def decrypt_credentials(self, encrypted_data: str) -> Dict[str, Any]:
        """
        解密 OAuth 凭据
        
        Args:
            encrypted_data: 加密后的 base64 编码字符串
            
        Returns:
            解密后的凭据字典
        """
        try:
            # 解码 base64
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode('utf-8'))
            
            # 解密
            decrypted_bytes = self.cipher.decrypt(encrypted_bytes)
            
            # 解析 JSON
            credentials_dict = json.loads(decrypted_bytes.decode('utf-8'))
            
            return credentials_dict
        except Exception as e:
            raise ValueError(f"Failed to decrypt credentials: {str(e)}")
