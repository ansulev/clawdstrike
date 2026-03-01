"""Tests for clawdstrike.hunt.watch module."""

from __future__ import annotations

import pytest

from clawdstrike.hunt.errors import WatchError
from clawdstrike.hunt.types import WatchConfig


class TestRunWatch:
    """Tests for run_watch function."""

    def test_import_succeeds(self) -> None:
        """Verify the module and function are importable."""
        from clawdstrike.hunt.watch import run_watch

        assert callable(run_watch)

    @pytest.mark.asyncio
    async def test_raises_without_nats(self) -> None:
        """run_watch should raise WatchError if nats-py is not installed."""
        # nats-py is an optional dependency and likely not installed in test env.
        try:
            import nats  # noqa: F401

            pytest.skip("nats-py is installed; cannot test missing-package path")
        except ImportError:
            pass

        from clawdstrike.hunt.watch import run_watch

        config = WatchConfig(
            nats_url="nats://localhost:4222",
            rules=(),
            max_window=__import__("datetime").timedelta(seconds=60),
        )

        with pytest.raises(WatchError, match="nats-py"):
            await run_watch(config, on_alert=lambda _: None)
