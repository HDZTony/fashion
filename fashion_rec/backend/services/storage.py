import boto3
import os
from botocore.exceptions import NoCredentialsError
from dotenv import load_dotenv
import uuid

load_dotenv()

R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL") # Optional, if different from endpoint

def get_r2_client():
    return boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY
    )

async def upload_file_to_r2(file_obj, filename: str, content_type: str) -> str:
    """
    Uploads a file-like object to Cloudflare R2 and returns the public URL.
    """
    s3 = get_r2_client()
    
    # Generate a unique filename to prevent collisions
    ext = filename.split('.')[-1]
    unique_filename = f"{uuid.uuid4()}.{ext}"
    
    try:
        s3.upload_fileobj(
            file_obj,
            R2_BUCKET_NAME,
            unique_filename,
            ExtraArgs={'ContentType': content_type}
        )
        
        # Construct Public URL
        if R2_PUBLIC_URL:
            return f"{R2_PUBLIC_URL}/{unique_filename}"
        else:
            # Fallback to endpoint URL structure if no public URL provided
            # Note: This might need adjustment based on specific R2 setup
            return f"{R2_ENDPOINT_URL}/{R2_BUCKET_NAME}/{unique_filename}"
            
    except NoCredentialsError:
        raise Exception("Credentials not available for R2")
    except Exception as e:
        raise Exception(f"Failed to upload to R2: {str(e)}")
