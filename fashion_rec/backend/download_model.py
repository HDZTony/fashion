import os
import sys

# Set HF Mirror
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

print("Setting HF_ENDPOINT to https://hf-mirror.com")
print("Downloading CLIP model (clip-ViT-B-32)...")

try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("clip-ViT-B-32")
    print("Successfully downloaded model!")
except Exception as e:
    print(f"Error downloading model: {e}")
    sys.exit(1)
