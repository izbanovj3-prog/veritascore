"""Text embedding with graceful degradation.

The evaluators need to turn model responses into vectors and compare them. We try
the best available backend and fall back automatically so the system runs even on
a Python build with no ML wheels:

    sentence-transformers  ->  scikit-learn TF-IDF  ->  pure-numpy hashing BoW

Every backend exposes the same ``embed(list[str]) -> np.ndarray`` returning unit
vectors that are comparable *within a single call* (which is exactly how the
evaluators use them: a pair, or baseline+current, embedded together).
"""

from __future__ import annotations

import math
import re
from functools import lru_cache

import numpy as np

from backend.config import settings

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


class _Embedder:
    name = "base"

    def embed(self, texts: list[str]) -> np.ndarray:  # pragma: no cover - interface
        raise NotImplementedError


class SentenceTransformerEmbedder(_Embedder):
    name = "sentence-transformers"

    def __init__(self) -> None:
        from sentence_transformers import SentenceTransformer  # may raise

        self._model = SentenceTransformer("all-MiniLM-L6-v2")

    def embed(self, texts: list[str]) -> np.ndarray:
        vecs = np.asarray(
            self._model.encode(list(texts), normalize_embeddings=True), dtype=np.float64
        )
        return vecs


class TfidfEmbedder(_Embedder):
    name = "tfidf"

    def __init__(self) -> None:
        from sklearn.feature_extraction.text import TfidfVectorizer  # may raise

        self._cls = TfidfVectorizer

    def embed(self, texts: list[str]) -> np.ndarray:
        # Fit on the provided corpus so the two/few texts share a vector space.
        vectorizer = self._cls()
        safe = [t if t.strip() else "__empty__" for t in texts]
        matrix = vectorizer.fit_transform(safe).toarray().astype(np.float64)
        return _l2_normalize(matrix)


class HashingEmbedder(_Embedder):
    """Always-available pure-numpy bag-of-words with feature hashing."""

    name = "hash"

    def __init__(self, dim: int = 1024) -> None:
        self.dim = dim

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), self.dim), dtype=np.float64)
        for i, text in enumerate(texts):
            for tok in _tokenize(text):
                # stable, process-independent hash
                h = 0
                for ch in tok:
                    h = (h * 131 + ord(ch)) & 0xFFFFFFFF
                out[i, h % self.dim] += 1.0
        return _l2_normalize(out)


def _l2_normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


@lru_cache(maxsize=1)
def get_embedder() -> _Embedder:
    """Return the best available embedder, honoring EMBEDDING_BACKEND."""
    pref = settings.embedding_backend.lower()
    order: list[type[_Embedder]]
    if pref == "sentence-transformers":
        order = [SentenceTransformerEmbedder, TfidfEmbedder, HashingEmbedder]
    elif pref == "tfidf":
        order = [TfidfEmbedder, HashingEmbedder]
    elif pref == "hash":
        order = [HashingEmbedder]
    else:  # auto
        order = [SentenceTransformerEmbedder, TfidfEmbedder, HashingEmbedder]

    for cls in order:
        try:
            return cls()
        except Exception:
            continue
    return HashingEmbedder()


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0:
        return 0.0
    return float(np.clip(np.dot(a, b) / denom, -1.0, 1.0))


def cosine_dist(a: np.ndarray, b: np.ndarray) -> float:
    return 1.0 - cosine_sim(a, b)


def pair_similarity(text_a: str, text_b: str) -> float:
    """Cosine similarity between two texts using the active embedder."""
    vecs = get_embedder().embed([text_a, text_b])
    return cosine_sim(vecs[0], vecs[1])


def isfinite(x: float) -> float:
    return x if math.isfinite(x) else 0.0
