"""
Severity scoring sidecar. Wraps the YOLOv8-seg trash model so the Node backend
can get a severity for a report's photos over HTTP instead of shelling out to
Python (which would reload the ~50MB model on every report).

Coverage is the UNION of predicted instance masks, not the sum of their areas --
overlapping detections would otherwise double-count and inflate the score.
Thresholds are a policy knob, not a property of the model: LOW is up to 10% of the
frame, MEDIUM up to 25%, HIGH above that. Picked from the sample set's own spread
(0.5%-40%, median ~24%) to split it roughly into thirds — re-measure before reusing
these on differently-framed photos. Tune to whatever dispatch policy needs.

    pip install -r requirements.txt
    uvicorn score:app --port 8100
"""

import base64
import io
import os
from typing import List

import numpy as np
from fastapi import FastAPI
from PIL import Image
from pydantic import BaseModel

WEIGHTS = os.environ.get("TRASH_WEIGHTS", os.path.join(os.path.dirname(__file__), "..", "trash_neg.pt"))
CONF = float(os.environ.get("TRASH_CONF", "0.25"))
LOW_MAX = 10.0     # coverage % up to this -> LOW
MEDIUM_MAX = 25.0  # coverage % up to this -> MEDIUM, above it -> HIGH

app = FastAPI()
_model = None


def model():
    global _model
    if _model is None:
        from ultralytics import YOLO
        _model = YOLO(WEIGHTS)
    return _model


def coverage_percent(result) -> float:
    """Percent of the image covered by trash, from the union of predicted masks."""
    if result.masks is None or len(result.masks) == 0:
        return 0.0

    h, w = result.orig_shape
    # .data is (N, mh, mw) at model resolution; collapse instances first, then
    # scale the single union mask up to the original image size.
    union = result.masks.data.any(dim=0).cpu().numpy().astype(np.uint8)

    if union.shape != (h, w):
        import cv2
        union = cv2.resize(union, (w, h), interpolation=cv2.INTER_NEAREST)

    return 100.0 * float(np.count_nonzero(union)) / (h * w)


def classify(coverage: float) -> str:
    # NONE is not a severity — it means the model saw no trash at all, and the
    # backend rejects the report rather than filing an empty one.
    if coverage == 0.0:
        return "NONE"
    if coverage <= LOW_MAX:
        return "LOW"
    if coverage <= MEDIUM_MAX:
        return "MEDIUM"
    return "HIGH"


def decode(image: str) -> Image.Image:
    """Accepts a data: URL or a bare base64 string (what the camera capture sends)."""
    if image.startswith("data:"):
        image = image.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(image))).convert("RGB")


class ScoreRequest(BaseModel):
    images: List[str]


@app.post("/score")
def score(req: ScoreRequest):
    # Worst photo wins: one bad angle of a big pile shouldn't be averaged away.
    coverage = 0.0
    for image in req.images:
        for result in model().predict(decode(image), conf=CONF, verbose=False):
            coverage = max(coverage, coverage_percent(result))

    return {"coveragePct": round(coverage, 3), "severity": classify(coverage)}


@app.get("/health")
def health():
    return {"ok": True, "weights": os.path.abspath(WEIGHTS)}


def _selfcheck():
    """Coverage math and thresholds, without needing the model or a real image."""
    import torch

    class FakeMasks:
        def __init__(self, data): self.data = data
        def __len__(self): return len(self.data)

    class FakeResult:
        def __init__(self, masks, shape): self.masks, self.orig_shape = masks, shape

    # two identical 50x50 boxes in a 100x100 image: union is 25%, sum would be 50%
    a = torch.zeros(100, 100); a[:50, :50] = 1
    assert abs(coverage_percent(FakeResult(FakeMasks(torch.stack([a, a.clone()])), (100, 100))) - 25.0) < 0.01

    # disjoint boxes do add up
    b = torch.zeros(100, 100); b[50:, 50:] = 1
    assert abs(coverage_percent(FakeResult(FakeMasks(torch.stack([a, b])), (100, 100))) - 50.0) < 0.01

    # mask at model resolution gets scaled to the original image size
    small = torch.zeros(50, 50); small[:25, :] = 1
    assert abs(coverage_percent(FakeResult(FakeMasks(small.unsqueeze(0)), (200, 200))) - 50.0) < 0.5

    assert coverage_percent(FakeResult(None, (10, 10))) == 0.0
    # Boundaries land in the lower band: 10% is LOW, 25% is MEDIUM.
    assert [classify(c) for c in (0.0, 1.0, 10.0, 10.1, 25.0, 25.1, 90.0)] == \
        ["NONE", "LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH"]

    # data: URL prefix is stripped, bare base64 also works
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    raw = base64.b64encode(png).decode()
    assert decode(raw).size == (1, 1)
    assert decode("data:image/png;base64," + raw).size == (1, 1)
    print("selfcheck ok")


if __name__ == "__main__":
    _selfcheck()
