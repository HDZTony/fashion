import boto3
import os
import socket
from botocore.exceptions import NoCredentialsError
from botocore.config import Config
from botocore.httpsession import URLLib3Session
from botocore.session import Session
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta
import json
import urllib3
import ssl
from io import BytesIO

load_dotenv()

# Disable SSL warnings for boto3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL") # Optional, if different from endpoint

def get_r2_client():
    """
    Create and return a boto3 S3 client configured for Cloudflare R2.
    Uses URLLib3Session with socket options to avoid SSL EOF issues.
    
    Note: The configuration uses URLLib3Session with socket options (SO_KEEPALIVE, TCP_NODELAY)
    which fixes SSL EOF issues while maintaining SSL verification enabled.
    """
    # Configure boto3 with retry strategy and SSL handling
    config = Config(
        retries={
            'max_attempts': 5,  # Increased retries for SSL issues
            'mode': 'adaptive'  # Adaptive retry mode for better error handling
        },
        connect_timeout=60,
        read_timeout=120  # Increased read timeout for large files
    )
    
    # 根本原因和解决方案：
    # - boto3默认使用requests库，而requests在处理R2的SSL连接时会出现EOF错误
    # - 使用URLLib3Session（基于urllib3）+ socket_options可以解决这个问题
    # - 配置socket选项（SO_KEEPALIVE, TCP_NODELAY）保持连接稳定
    
    # 配置socket选项，修复SSL EOF问题
    socket_options = [
        (socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1),
        (socket.IPPROTO_TCP, socket.TCP_NODELAY, 1),
    ]
    
    # 使用URLLib3Session + socket_options，保持SSL验证启用
    # 注意：如果使用VPN/代理，可能需要配置代理设置
    # 但为了稳定性，我们优先尝试直连（不通过系统代理）
    http_client = URLLib3Session(
        verify=True,
        socket_options=socket_options,
        max_pool_connections=10,
        proxies=None  # 明确设置为None，避免使用系统代理
    )
    
    # Create a custom session with the HTTP client
    session = Session()
    session.register_component('http_client', http_client)
    
    # Create boto3 client using the custom session
    return session.create_client(
        's3',
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=config
    )

async def upload_file_to_r2(file_obj, filename: str, content_type: str, expires_in_days: int = None) -> str:
    """
    Uploads a file-like object to Cloudflare R2 and returns the public URL.
    
    Args:
        file_obj: File-like object to upload
        filename: Original filename (used to determine extension)
        content_type: MIME type of the file
        expires_in_days: Optional number of days after which the file should be deleted (for lifecycle management)
    """
    # Cache file content to BytesIO before any upload attempts
    # This ensures we can retry even if the original file object is closed
    try:
        # Try to read current position to preserve it
        original_position = 0
        if hasattr(file_obj, 'tell'):
            try:
                original_position = file_obj.tell()
            except (ValueError, OSError, AttributeError):
                pass
        
        # Read all file content into memory
        if hasattr(file_obj, 'read'):
            file_content = file_obj.read()
        else:
            # If it's not a readable object, try to get it as bytes
            file_content = bytes(file_obj) if isinstance(file_obj, (bytes, bytearray)) else None
            if file_content is None:
                raise ValueError("Cannot read from file object")
        
        # Create a BytesIO object from the cached content
        cached_file_obj = BytesIO(file_content)
        print(f"[R2] Cached file content to memory ({len(file_content)} bytes) for retry support")
    except Exception as e:
        raise Exception(f"Failed to cache file content for upload: {str(e)}")
    
    s3 = get_r2_client()
    
    # Generate a unique filename to prevent collisions
    ext = filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{ext}"
    
    try:
        # Prepare metadata
        metadata = {}
        if expires_in_days:
            # Store expiration timestamp in metadata
            expiration_date = datetime.utcnow() + timedelta(days=expires_in_days)
            metadata['expires_at'] = expiration_date.isoformat() + 'Z'
            metadata['expires_in_days'] = str(expires_in_days)
        
        # Upload with retry logic
        # Note: SSL errors should be resolved by socket_options configuration
        # Retries are mainly for network issues, not SSL problems
        max_retries = 5
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Get a fresh client for each attempt to avoid connection reuse issues
                if attempt > 0:
                    s3 = get_r2_client()  # Use default configuration (SSL enabled)
                    print(f"[R2] Retry attempt {attempt + 1}/{max_retries} for {unique_filename}")
                else:
                    print(f"[R2] Starting upload attempt {attempt + 1}/{max_retries} for {unique_filename}")
                
                # Reset cached file object to beginning for each attempt
                cached_file_obj.seek(0)
                
                # Use put_object instead of upload_fileobj (boto3 client method)
                s3.put_object(
                    Bucket=R2_BUCKET_NAME,
                    Key=unique_filename,
                    Body=cached_file_obj,
                    ContentType=content_type,
                    Metadata=metadata
                )
                # Success, break out of retry loop
                print(f"[R2] Successfully uploaded {unique_filename} on attempt {attempt + 1}")
                break
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                error_type = type(e).__name__
                
                # Enhanced SSL error detection
                is_ssl_error = (
                    "ssl" in error_str or 
                    "unexpected_eof" in error_str or
                    "ssl validation failed" in error_str or
                    "certificate" in error_str or
                    "tls" in error_str or
                    "eof" in error_str or
                    "ssl:" in error_str or
                    "_ssl.c:" in error_str or
                    "violation of protocol" in error_str
                )
                
                # Log detailed error information
                print(f"[R2] Upload error on attempt {attempt + 1}/{max_retries} (type: {error_type}): {str(e)[:300]}")
                
                # If it's an SSL error and not the last attempt, retry
                if is_ssl_error and attempt < max_retries - 1:
                    print(f"[R2] Detected SSL-related error, will retry with SSL verification disabled")
                    # Wait a bit before retry (exponential backoff)
                    import time
                    wait_time = min(2 ** attempt, 10)  # Max 10 seconds
                    print(f"[R2] Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                    continue
                else:
                    # Not an SSL error or last attempt, raise immediately
                    if attempt == max_retries - 1:
                        print(f"[R2] Failed after {max_retries} attempts. Final error: {error_type}: {str(e)[:300]}")
                    raise
        
        # If we exhausted retries, raise the last error
        if last_error:
            raise Exception(f"Failed to upload to R2 after {max_retries} attempts: {str(last_error)}")
        
        # Construct Public URL
        if R2_PUBLIC_URL:
            public_url = f"{R2_PUBLIC_URL}/{unique_filename}"
        else:
            # Fallback to endpoint URL structure if no public URL provided
            # Note: This might need adjustment based on specific R2 setup
            public_url = f"{R2_ENDPOINT_URL}/{R2_BUCKET_NAME}/{unique_filename}"
        
        if expires_in_days:
            print(f"[R2] Uploaded file with {expires_in_days}-day expiration: {unique_filename} (expires: {metadata['expires_at']})")
        
        return public_url
            
    except NoCredentialsError as e:
        print(f"[R2] Credentials error: {str(e)}")
        raise Exception("Credentials not available for R2")
    except Exception as e:
        error_type = type(e).__name__
        print(f"[R2] Upload failed with {error_type}: {str(e)[:300]}")
        raise Exception(f"Failed to upload to R2: {str(e)}")
    finally:
        # Clean up cached file object
        try:
            if 'cached_file_obj' in locals() and cached_file_obj:
                cached_file_obj.close()
        except Exception as cleanup_error:
            print(f"[R2] Warning: Error during cleanup: {cleanup_error}")


async def delete_expired_files_from_r2():
    """
    Deletes files from R2 that have expired based on their metadata.
    This should be called periodically (e.g., via a scheduled task).
    """
    s3 = get_r2_client()
    current_time = datetime.utcnow()
    deleted_count = 0
    
    try:
        # List all objects in the bucket
        paginator = s3.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=R2_BUCKET_NAME)
        
        for page in pages:
            if 'Contents' not in page:
                continue
                
            for obj in page['Contents']:
                key = obj['Key']
                
                try:
                    # Get object metadata
                    head_response = s3.head_object(Bucket=R2_BUCKET_NAME, Key=key)
                    metadata = head_response.get('Metadata', {})
                    
                    expires_at_str = metadata.get('expires_at')
                    if expires_at_str:
                        expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                        expires_at_utc = expires_at.replace(tzinfo=None)
                        
                        if current_time >= expires_at_utc:
                            # File has expired, delete it
                            s3.delete_object(Bucket=R2_BUCKET_NAME, Key=key)
                            deleted_count += 1
                            print(f"[R2] Deleted expired file: {key} (expired at {expires_at_str})")
                except Exception as e:
                    print(f"[R2] Error checking/deleting file {key}: {e}")
                    continue
        
        if deleted_count > 0:
            print(f"[R2] Cleanup completed: deleted {deleted_count} expired file(s)")
        else:
            print(f"[R2] Cleanup completed: no expired files found")
            
    except Exception as e:
        print(f"[R2] Error during cleanup: {e}")


def delete_file_from_r2_by_url(url: str) -> bool:
    """
    Deletes a file from R2 by its public URL.
    
    Args:
        url: Public URL of the file to delete
        
    Returns:
        True if deletion was successful, False otherwise
    """
    try:
        # Extract filename from URL
        if R2_PUBLIC_URL and url.startswith(R2_PUBLIC_URL):
            filename = url.replace(R2_PUBLIC_URL + '/', '')
        else:
            # Try to extract from URL
            filename = url.split('/')[-1]
        
        s3 = get_r2_client()
        s3.delete_object(Bucket=R2_BUCKET_NAME, Key=filename)
        print(f"[R2] Deleted file: {filename}")
        return True
    except Exception as e:
        print(f"[R2] Error deleting file {url}: {e}")
        return False
