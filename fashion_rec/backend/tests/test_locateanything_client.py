import asyncio

from services.locateanything_client import (
    LocateAnythingError,
    image_url_fetchable_by_locateanything,
    parse_locateanything_boxes,
    rewrite_image_url_for_locateanything_fetch,
)
from services import garment_vl_pipeline as pipeline


def test_rewrite_localhost_to_tailnet_host(monkeypatch):
    monkeypatch.setenv("LOCATEANYTHING_TAILNET_DEV_HOST", "100.127.212.44")
    out = rewrite_image_url_for_locateanything_fetch("http://127.0.0.1:8001/foo.jpg")
    assert out == "http://100.127.212.44:8001/foo.jpg"
    assert image_url_fetchable_by_locateanything("http://127.0.0.1:8001/foo.jpg")


def test_parse_locateanything_single_box():
    boxes = parse_locateanything_boxes(
        "The garment is here <box><10><20><300><400></box>.",
        role="top",
        label="black top",
    )

    assert boxes == [
        {"role": "top", "label": "black top", "bbox_2d": [10, 20, 300, 400]}
    ]


def test_parse_locateanything_multiple_boxes_with_cap():
    boxes = parse_locateanything_boxes(
        "<box><1><2><100><200></box> <box><300><400><500><600></box>",
        max_items=1,
    )

    assert len(boxes) == 1
    assert boxes[0]["bbox_2d"] == [1, 2, 100, 200]


def test_parse_locateanything_rejects_empty_reversed_and_out_of_range_boxes():
    text = (
        "nothing useful "
        "<box><300><20><10><400></box> "
        "<box><10><20><1200><400></box>"
    )

    assert parse_locateanything_boxes(text) == []


def test_detect_uses_locate_bytes_for_local_url(monkeypatch):
    captured: dict = {}

    async def fake_locate_garment_boxes(**kwargs):
        captured.update(kwargs)
        return [{"role": "other", "label": "garment", "bbox_2d": [1, 2, 3, 4]}]

    async def fake_fetch(url):
        return b"local-image"

    monkeypatch.setattr(pipeline, "locateanything_enabled", lambda: True)
    monkeypatch.setattr(pipeline, "image_url_fetchable_by_locateanything", lambda _: False)
    monkeypatch.setattr(pipeline, "fetch_image_bytes", fake_fetch)
    monkeypatch.setattr(
        pipeline,
        "downscale_image_bytes_for_qwen_data_uri",
        lambda b: b,
    )
    monkeypatch.setattr(pipeline, "locate_garment_boxes", fake_locate_garment_boxes)
    async def fail_qwen(*args, **kwargs):
        raise AssertionError("Qwen fallback should not be called")

    monkeypatch.setattr(pipeline, "qwen_detect_garment_boxes_for_intent", fail_qwen)

    boxes = asyncio.run(
        pipeline.detect_garment_boxes_for_intent(
            "http://127.0.0.1:8001/chatkit/attachments/x/preview",
            "black top",
        )
    )

    assert boxes[0]["bbox_2d"] == [1, 2, 3, 4]
    assert captured.get("image_bytes") == b"local-image"


def test_detect_uses_locateanything_without_qwen_fallback(monkeypatch):
    async def fake_locate_garment_boxes(**kwargs):
        return [{"role": "other", "label": "garment", "bbox_2d": [1, 2, 3, 4]}]

    async def fail_qwen(*args, **kwargs):
        raise AssertionError("Qwen fallback should not be called")

    monkeypatch.setattr(pipeline, "locateanything_enabled", lambda: True)
    monkeypatch.setattr(pipeline, "image_url_fetchable_by_locateanything", lambda _: True)
    monkeypatch.setattr(pipeline, "locate_garment_boxes", fake_locate_garment_boxes)
    monkeypatch.setattr(pipeline, "qwen_detect_garment_boxes_for_intent", fail_qwen)

    boxes = asyncio.run(
        pipeline.detect_garment_boxes_for_intent(
            "https://example.com/a.jpg",
            "black top",
            image_bytes=b"image",
        )
    )

    assert boxes[0]["bbox_2d"] == [1, 2, 3, 4]


def test_detect_falls_back_to_qwen_when_locateanything_fails(monkeypatch):
    calls = {"qwen": 0}

    async def fake_locate_garment_boxes(**kwargs):
        raise LocateAnythingError("timeout")

    async def fake_qwen(*args, **kwargs):
        calls["qwen"] += 1
        return [{"role": "top", "label": "fallback", "bbox_2d": [10, 20, 30, 40]}]

    monkeypatch.setattr(pipeline, "locateanything_enabled", lambda: True)
    monkeypatch.setattr(pipeline, "image_url_fetchable_by_locateanything", lambda _: True)
    monkeypatch.setattr(pipeline, "locate_garment_boxes", fake_locate_garment_boxes)
    monkeypatch.setattr(pipeline, "qwen_detect_garment_boxes_for_intent", fake_qwen)

    boxes = asyncio.run(
        pipeline.detect_garment_boxes_for_intent(
            "https://example.com/a.jpg",
            "black top",
            image_bytes=b"image",
        )
    )

    assert calls["qwen"] == 1
    assert boxes[0]["label"] == "fallback"


def test_extract_or_passthrough_urls_uses_detected_crop(monkeypatch):
    async def fake_fetch_image_bytes(url):
        return b"image"

    async def fake_detect_garment_boxes(*args, **kwargs):
        return [{"role": "top", "label": "top", "bbox_2d": [0, 0, 1000, 1000]}]

    async def fake_crop_boxes_upload(*args, **kwargs):
        return ["https://r2.example/crop.png"]

    monkeypatch.setattr(pipeline, "fetch_image_bytes", fake_fetch_image_bytes)
    monkeypatch.setattr(pipeline, "detect_garment_boxes", fake_detect_garment_boxes)
    monkeypatch.setattr(pipeline, "crop_boxes_upload", fake_crop_boxes_upload)

    payload = asyncio.run(
        pipeline.extract_or_passthrough_urls(
            ["https://example.com/source.jpg"],
            [True],
            "black top",
        )
    )

    assert payload["garment_urls"] == ["https://r2.example/crop.png"]


def test_intent_preview_multi_uses_assignments_and_skips_scene(monkeypatch):
    seen_sources: list[str] = []

    async def fake_plan_multi_image_intent_crops(image_urls, intent_text):
        return (
            [
                {"image_index": 0, "focus": "black top", "max_crops": 1},
                {"image_index": 2, "focus": "white skirt", "max_crops": 1},
            ],
            1,
        )

    async def fake_fetch_image_bytes(url):
        return b"image"

    async def fake_detect_for_intent(image_url, *args, **kwargs):
        seen_sources.append(image_url)
        return [{"role": "other", "label": "garment", "bbox_2d": [0, 0, 1000, 1000]}]

    async def fake_crop_boxes_upload(*args, **kwargs):
        return [f"https://r2.example/{len(seen_sources)}.png"]

    monkeypatch.setattr(
        pipeline, "plan_multi_image_intent_crops", fake_plan_multi_image_intent_crops
    )
    monkeypatch.setattr(pipeline, "fetch_image_bytes", fake_fetch_image_bytes)
    monkeypatch.setattr(pipeline, "detect_garment_boxes_for_intent", fake_detect_for_intent)
    monkeypatch.setattr(pipeline, "crop_boxes_upload", fake_crop_boxes_upload)

    rows, scene_idx = asyncio.run(
        pipeline.intent_preview_crops(
            [
                "https://example.com/top.jpg",
                "https://example.com/scene.jpg",
                "https://example.com/skirt.jpg",
            ],
            "try this outfit in the scene",
        )
    )

    assert scene_idx == 1
    assert seen_sources == [
        "https://example.com/top.jpg",
        "https://example.com/skirt.jpg",
    ]
    assert [r["source_url"] for r in rows] == seen_sources
