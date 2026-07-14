"""
LocateAnything-3B bbox HTTP service for fashion_rec backend.

POST /v1/locate        {"image_url": "...", "prompt": "..."}
POST /v1/locate_bytes  {"image_base64": "...", "prompt": "..."}  # local / private images
GET  /health
"""

from __future__ import annotations

import base64
import binascii
import logging
import os
import sys
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel, Field

from worker import LocateAnythingWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("locateanything")

ROOT = Path(__file__).resolve().parent
LOCAL_PATH = Path(os.getenv("LOCATEANYTHING_MODEL_DIR", ROOT / "model_weights"))
HOST = os.getenv("LOCATEANYTHING_HOST", "0.0.0.0")
PORT = int(os.getenv("LOCATEANYTHING_PORT", "8000"))
IMAGE_FETCH_TIMEOUT = float(os.getenv("LOCATEANYTHING_IMAGE_TIMEOUT", "15"))
MAX_IMAGE_BYTES = int(os.getenv("LOCATEANYTHING_MAX_IMAGE_BYTES", str(12 * 1024 * 1024)))

_worker: LocateAnythingWorker | None = None


class LocateTask(BaseModel):
    image_url: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)


class LocateBytesTask(BaseModel):
    image_base64: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)


def _load_worker() -> LocateAnythingWorker:
    if not LOCAL_PATH.is_dir() or not (LOCAL_PATH / "config.json").exists():
        raise RuntimeError(
            f"Model weights not found at {LOCAL_PATH}. Run download-model.ps1 first."
        )
    logger.info("Loading LocateAnything-3B from %s", LOCAL_PATH)
    worker = LocateAnythingWorker(str(LOCAL_PATH))
    logger.info("Model ready on %s", worker.device)
    return worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker
    _worker = _load_worker()
    yield
    _worker = None


app = FastAPI(title="LocateAnything-3B", version="1.1.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    ready = _worker is not None
    return {
        "status": "ok" if ready else "loading",
        "model_dir": str(LOCAL_PATH),
    }


def _decode_image_bytes(raw: bytes) -> Image.Image:
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large ({len(raw)} bytes, max {MAX_IMAGE_BYTES})",
        )
    try:
        return Image.open(BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}") from e


def _decode_image_base64(b64: str) -> Image.Image:
    try:
        raw = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid image_base64: {e}") from e
    return _decode_image_bytes(raw)


def _predict_boxes(img: Image.Image, prompt: str) -> str:
    if _worker is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        result = _worker.predict(
            img,
            prompt,
            generation_mode=os.getenv("LOCATEANYTHING_GENERATION_MODE", "hybrid"),
            max_new_tokens=int(os.getenv("LOCATEANYTHING_MAX_NEW_TOKENS", "2048")),
            verbose=False,
        )
        return result.get("answer", "")
    except Exception as e:
        logger.exception("Inference failed")
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/v1/locate")
async def locate(task: LocateTask) -> dict[str, object]:
    try:
        async with httpx.AsyncClient(
            timeout=IMAGE_FETCH_TIMEOUT, follow_redirects=True
        ) as client:
            resp = await client.get(task.image_url)
            resp.raise_for_status()
            raw = resp.content
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to fetch image_url: {e}"
        ) from e

    img = _decode_image_bytes(raw)
    text = _predict_boxes(img, task.prompt)
    logger.info("locate ok url=%s answer_len=%d", task.image_url[:80], len(text))
    return {"status": "success", "result": text}


@app.post("/v1/locate_bytes")
async def locate_bytes(task: LocateBytesTask) -> dict[str, object]:
    img = _decode_image_base64(task.image_base64)
    text = _predict_boxes(img, task.prompt)
    logger.info("locate_bytes ok answer_len=%d", len(text))
    return {"status": "success", "result": text}


if __name__ == "__main__":
    uvicorn.run(
        "run_model:app",
        host=HOST,
        port=PORT,
        log_level="info",
        reload=False,
    )
