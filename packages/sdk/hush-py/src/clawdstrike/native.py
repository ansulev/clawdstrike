"""Native Rust backend detection and imports.

This module attempts to load the bundled native Rust bindings
(`clawdstrike._native`). If unavailable, ``NATIVE_AVAILABLE`` will be
``False`` and native_* functions will be ``None``.
"""
from __future__ import annotations

import os
from collections.abc import Callable

# Try to import native bindings
NATIVE_AVAILABLE: bool = False
is_native_available: Callable[[], bool] | None = None
sha256_native: Callable[[bytes], bytes] | None = None
keccak256_native: Callable[[bytes], bytes] | None = None
merkle_root_native: Callable[[list[bytes]], bytes] | None = None
verify_receipt_native: Callable[[str, str, str], bool] | None = None
verify_ed25519_native: Callable[[bytes, bytes, bytes], bool] | None = None
generate_merkle_proof_native: Callable[[list[bytes], int], tuple[int, int, list[str]]] | None = None
canonicalize_native: Callable[[str], str] | None = None
detect_jailbreak_native: Callable[..., dict] | None = None
sanitize_output_native: Callable[..., dict] | None = None
watermark_public_key_native: Callable[[str], str] | None = None
watermark_prompt_native: Callable[..., dict] | None = None
extract_watermark_native: Callable[..., dict] | None = None

_NATIVE_DISABLED = os.getenv("CLAWDSTRIKE_DISABLE_NATIVE", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

if not _NATIVE_DISABLED:
    try:
        from clawdstrike import _native as _native_mod

        NATIVE_AVAILABLE = True
        is_native_available = getattr(_native_mod, "is_native_available", None)
        sha256_native = getattr(_native_mod, "sha256_native", None)
        merkle_root_native = getattr(_native_mod, "merkle_root_native", None)
        verify_receipt_native = getattr(_native_mod, "verify_receipt_native", None)

        # Import optional functions that may not exist in older wheels.
        _OPTIONAL_BINDINGS = [
            "keccak256_native",
            "verify_ed25519_native",
            "generate_merkle_proof_native",
            "canonicalize_native",
            "detect_jailbreak_native",
            "sanitize_output_native",
            "watermark_public_key_native",
            "watermark_prompt_native",
            "extract_watermark_native",
        ]
        for _name in _OPTIONAL_BINDINGS:
            _fn = getattr(_native_mod, _name, None)
            if _fn is not None:
                globals()[_name] = _fn

        del _OPTIONAL_BINDINGS, _name, _fn

    except ImportError:
        # Native extension is unavailable; keep pure-Python fallback.
        NATIVE_AVAILABLE = False
else:
    NATIVE_AVAILABLE = False


def get_native_module():
    """Return the bundled native module, raising NativeBackendError if unavailable."""
    if not NATIVE_AVAILABLE:
        from clawdstrike.exceptions import NativeBackendError
        if _NATIVE_DISABLED:
            raise NativeBackendError(
                "clawdstrike native extension disabled via CLAWDSTRIKE_DISABLE_NATIVE"
            )
        raise NativeBackendError("clawdstrike native extension not available")
    from clawdstrike import _native
    return _native


def init_native() -> bool:
    """Check if the native backend is available and has the NativeEngine class.

    Returns:
        True if native engine is available, False otherwise.
    """
    if _NATIVE_DISABLED:
        return False
    try:
        from clawdstrike import _native
        return hasattr(_native, "NativeEngine")
    except ImportError:
        return False


__all__ = [
    "NATIVE_AVAILABLE",
    "get_native_module",
    "init_native",
    "is_native_available",
    "sha256_native",
    "keccak256_native",
    "merkle_root_native",
    "verify_receipt_native",
    "verify_ed25519_native",
    "generate_merkle_proof_native",
    "canonicalize_native",
    "detect_jailbreak_native",
    "sanitize_output_native",
    "watermark_public_key_native",
    "watermark_prompt_native",
    "extract_watermark_native",
]
