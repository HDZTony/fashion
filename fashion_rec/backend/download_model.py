import os
import sys

# Optional mirror (China); default official hub — hf-mirror SSL errors are common
if not os.getenv("HF_ENDPOINT"):
    print("HF_ENDPOINT unset — using https://huggingface.co (set HF_ENDPOINT=https://hf-mirror.com if needed)")
else:
    print(f"HF_ENDPOINT={os.getenv('HF_ENDPOINT')}")
print("Downloading CLIP model (clip-ViT-B-32)...")

try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("clip-ViT-B-32")
    print("Successfully downloaded model!")
except Exception as e:
    print(f"Error downloading model: {e}")
    sys.exit(1)
