"""
Google Search Console 凭据数据库服务
用于存储和检索用户的 Search Console OAuth 凭据
"""
from typing import Optional, Dict, Any
from supabase import Client
from .supabase_client import create_supabase_client
from .credentials_manager import CredentialsManager


class SearchConsoleDB:
    """管理 Search Console 凭据的数据库操作"""
    
    TABLE_NAME = "user_search_console_credentials"
    
    def __init__(self):
        self.client: Client = create_supabase_client()
        self.table = self.client.table(self.TABLE_NAME)
        self.credentials_manager = CredentialsManager()
    
    def save_credentials(
        self,
        user_id: str,
        credentials_dict: Dict[str, Any],
        site_url: Optional[str] = None
    ) -> bool:
        """
        保存用户的 Search Console 凭据（加密存储）
        用于初始保存和 token 刷新后的更新
        
        Args:
            user_id: 用户 ID
            credentials_dict: OAuth 凭据字典
            site_url: 关联的网站 URL（如果提供则更新，否则保持原有值）
            
        Returns:
            是否保存成功
        """
        try:
            # 加密凭据
            encrypted_credentials = self.credentials_manager.encrypt_credentials(credentials_dict)
            
            # 准备数据
            data = {
                'user_id': user_id,
                'credentials_json': {'encrypted': encrypted_credentials},  # 存储为 JSONB
            }
            
            # 如果提供了 site_url，则更新；否则保持原有值
            if site_url:
                data['site_url'] = site_url
            else:
                # 尝试从现有记录获取 site_url
                existing = self.table.select('site_url').eq('user_id', user_id).execute()
                if existing.data and existing.data[0].get('site_url'):
                    data['site_url'] = existing.data[0]['site_url']
                else:
                    data['site_url'] = 'https://fashion-rec.com'
            
            # 使用 upsert（如果存在则更新，不存在则插入）
            result = self.table.upsert(data, on_conflict='user_id').execute()
            
            return True
        except Exception as e:
            print(f"[SearchConsoleDB] Failed to save credentials: {e}")
            return False
    
    def get_credentials(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        获取用户的 Search Console 凭据（解密）
        
        Args:
            user_id: 用户 ID
            
        Returns:
            解密后的凭据字典，如果不存在则返回 None
        """
        try:
            result = self.table.select('credentials_json, site_url').eq('user_id', user_id).execute()
            
            if not result.data or len(result.data) == 0:
                return None
            
            row = result.data[0]
            credentials_json = row.get('credentials_json', {})
            
            # 处理两种格式：{'encrypted': '...'} 或直接是字符串
            if isinstance(credentials_json, dict):
                encrypted_data = credentials_json.get('encrypted')
            else:
                encrypted_data = credentials_json
            
            if not encrypted_data:
                return None
            
            # 解密凭据
            credentials_dict = self.credentials_manager.decrypt_credentials(encrypted_data)
            
            # 添加 site_url 到凭据中（如果需要）
            if row.get('site_url'):
                credentials_dict['site_url'] = row['site_url']
            
            return credentials_dict
        except Exception as e:
            print(f"[SearchConsoleDB] Failed to get credentials: {e}")
            return None
    
    def delete_credentials(self, user_id: str) -> bool:
        """
        删除用户的 Search Console 凭据
        
        Args:
            user_id: 用户 ID
            
        Returns:
            是否删除成功
        """
        try:
            result = self.table.delete().eq('user_id', user_id).execute()
            return True
        except Exception as e:
            print(f"[SearchConsoleDB] Failed to delete credentials: {e}")
            return False
    
    def has_credentials(self, user_id: str) -> bool:
        """
        检查用户是否有存储的凭据
        
        Args:
            user_id: 用户 ID
            
        Returns:
            是否存在凭据
        """
        try:
            result = self.table.select('user_id').eq('user_id', user_id).limit(1).execute()
            return len(result.data) > 0
        except Exception:
            return False
