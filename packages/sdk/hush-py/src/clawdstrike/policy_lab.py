"""PolicyLab: unified observe -> hunt -> OCSF -> synth pipeline (native-backed).

Requires the hush_native extension with PolicyLab support.
"""

from __future__ import annotations

from typing import Any

from clawdstrike.native import NATIVE_AVAILABLE, get_native_module


def _require_native() -> None:
    """Fail-closed: ensure native PolicyLab bindings are available."""
    if not NATIVE_AVAILABLE:
        raise ImportError(
            "clawdstrike.policy_lab requires the native extension (hush-native). "
            "Build/install from `packages/sdk/hush-py/hush-native`."
        )
    mod = get_native_module()
    if not hasattr(mod, "PolicyLab"):
        raise ImportError(
            "hush-native does not include PolicyLab bindings. "
            "Rebuild with latest hush-native."
        )


class PolicyLab:
    """Unified observe -> hunt -> OCSF -> synth pipeline."""

    def __init__(self, policy_yaml: str) -> None:
        _require_native()
        mod = get_native_module()
        self._inner = mod.PolicyLab(policy_yaml)

    def simulate(self, events_jsonl: str) -> dict[str, Any]:
        """Simulate events against the loaded policy."""
        return self._inner.simulate(events_jsonl)

    @staticmethod
    def synth(events_jsonl: str) -> dict[str, Any]:
        """Synthesize a candidate policy from observed events."""
        _require_native()
        mod = get_native_module()
        return mod.PolicyLab.synth(events_jsonl)

    @staticmethod
    def to_ocsf(events_jsonl: str) -> str:
        """Convert PolicyEvent JSONL to OCSF JSONL."""
        _require_native()
        mod = get_native_module()
        return mod.PolicyLab.to_ocsf(events_jsonl)

    @staticmethod
    def to_timeline(events_jsonl: str) -> str:
        """Convert PolicyEvent JSONL to TimelineEvent JSONL."""
        _require_native()
        mod = get_native_module()
        return mod.PolicyLab.to_timeline(events_jsonl)
