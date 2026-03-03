#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${REPO_ROOT}" python3 - <<'PY'
from pathlib import Path
import os
import shutil

repo_root = Path(os.environ["REPO_ROOT"])
src_root = repo_root / "packages" / "sdk" / "hush-py" / "src"
dst_root = repo_root / "packages" / "sdk" / "hush-py" / "hush-native" / "python"
rulesets_root = repo_root / "rulesets"

def sync_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__"))

dst_root.mkdir(parents=True, exist_ok=True)
sync_tree(src_root / "clawdstrike", dst_root / "clawdstrike")
sync_tree(rulesets_root, dst_root / "clawdstrike" / "rulesets")

src_hush = src_root / "hush"
dst_hush = dst_root / "hush"
if src_hush.exists():
    sync_tree(src_hush, dst_hush)
elif dst_hush.exists():
    shutil.rmtree(dst_hush)

print(f"Synced Python sources and rulesets into {dst_root}")
PY
