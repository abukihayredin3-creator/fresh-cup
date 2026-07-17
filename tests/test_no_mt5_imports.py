"""Structural safety guarantee: the AI Brain can never execute trades
because it never imports an MT5/broker library in the first place.

This turns the architectural guarantee described in ai_brain/README.md
into a checked invariant rather than just a comment: if anyone ever adds
`import MetaTrader5` (or similar) to ai_brain/, this test fails CI.
"""

import ast
from pathlib import Path

AI_BRAIN_DIR = Path(__file__).resolve().parent.parent / "ai_brain"
FORBIDDEN_MODULES = {"mt5", "MetaTrader5", "metatrader5"}


def _imported_module_names(source: str) -> set[str]:
    tree = ast.parse(source)
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module.split(".")[0])
    return names


def test_no_mt5_import_anywhere_in_ai_brain():
    offenders = []
    for path in AI_BRAIN_DIR.rglob("*.py"):
        source = path.read_text()
        imported = _imported_module_names(source)
        if imported & FORBIDDEN_MODULES:
            offenders.append(str(path))

    assert not offenders, f"Found forbidden MT5/broker imports in: {offenders}"
