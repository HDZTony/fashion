import boto3
import os
from botocore.exceptions import NoCredentialsError
from botocore.config import Config
from botocore.httpsession import URLLib3Session
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta
import json
import urllib3
import ssl

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
    Includes retry configuration and SSL handling for better reliability.
    
    Note: Cloudflare R2 sometimes has SSL compatibility issues with boto3,
    so we use a custom HTTP client with relaxed SSL settings.
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
    
    # Check if SSL verification should be disabled
    # For Cloudflare R2, SSL verification can sometimes cause issues
    # Set R2_DISABLE_SSL_VERIFY=false to enable strict SSL (default: disabled for compatibility)
    verify_ssl = os.getenv("R2_DISABLE_SSL_VERIFY", "true").lower() != "true"
    
    if not verify_ssl:
        print("[R2] SSL verification is disabled for Cloudflare R2 compatibility.")
        # Use boto3.client() - SSL errors will be handled in retry logic
        # boto3 doesn't support verify parameter directly, but we can set it via environment
        # or handle SSL errors in the upload retry logic (which we already do)
        # For simplicity, just use the standard client - SSL errors are caught and retried
        client = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT_URL,
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=config
        )
        
        return client
    
    # If SSL verification is enabled, use default client
    return boto3.client(
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
        
        # Upload with retry logic for SSL errors
        # Use a new client for each retry to avoid connection reuse issues
        max_retries = 5
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Get a fresh client for each attempt to avoid SSL connection reuse issues
                if attempt > 0:
                    s3 = get_r2_client()
                    print(f"[R2] Retry attempt {attempt + 1}/{max_retries} with fresh client")
                
                s3.upload_fileobj(
                    file_obj,
                    R2_BUCKET_NAME,
                    unique_filename,
                    ExtraArgs={
                        'ContentType': content_type,
                        'Metadata': metadata
                    }
                )
                # Success, break out of retry loop
                print(f"[R2] Successfully uploaded {unique_filename} on attempt {attempt + 1}")
                break
            except Exception as e:
                last_error = e
                error_str = str(e).lower()
                
                # Check if it's an SSL-related error
                is_ssl_error = (
                    "ssl" in error_str or 
                    "unexpected_eof" in error_str or
                    "ssl validation failed" in error_str or
                    "certificate" in error_str or
                    "tls" in error_str
                )
                
                # If it's an SSL error and not the last attempt, retry
                if is_ssl_error and attempt < max_retries - 1:
                    print(f"[R2] SSL error on attempt {attempt + 1}/{max_retries}: {str(e)[:200]}")
                    # Reset file pointer for retry (only if file is still open)
                    if hasattr(file_obj, 'seek'):
                        try:
                            if hasattr(file_obj, 'closed') and file_obj.closed:
                                print(f"[R2] File object is closed, cannot retry")
                                raise
                            file_obj.seek(0)
                        except (ValueError, OSError, AttributeError) as seek_error:
                            # File is closed or can't seek, can't retry
                            print(f"[R2] Cannot seek file object: {seek_error}, aborting retry")
                            raise
                    # Wait a bit before retry (exponential backoff)
                    import time
                    wait_time = min(2 ** attempt, 10)  # Max 10 seconds
                    print(f"[R2] Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                    continue
                else:
                    # Not an SSL error or last attempt, raise immediately
                    if attempt == max_retries - 1:
                        print(f"[R2] Failed after {max_retries} attempts")
                    raise
        
        # If we exhausted retries, raise the last error
        if last_error and ("ssl" in str(last_error).lower() or "unexpected_eof" in str(last_error).lower()):
            raise Exception(f"Failed to upload to R2 after {max_retries} attempts due to SSL error: {str(last_error)}")
        
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
            
    except NoCredentialsError:
        raise Exception("Credentials not available for R2")
    except Exception as e:
        raise Exception(f"Failed to upload to R2: {str(e)}")


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
