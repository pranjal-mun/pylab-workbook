#!/usr/bin/env python3
"""Add targeted fourth tests to advanced exercises that only had three."""

from __future__ import annotations

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

ADDITIONS = {
    "dictionaries-bingo-win": ("unmarked card does not win", "card = {letter: [1, 2, 3, 4, 5] for letter in 'BINGO'}\nassert is_winning_card(card) is False"),
    "dictionaries-bingo-simulation": ("supports one complete game", "low, high, average = simulate_bingo(1, seed=11)\nassert low == high == average\nassert 5 <= low <= 75"),
    "conditionals-next-date": ("crosses an ordinary month boundary", "assert next_date(2023, 4, 30) == (2023, 5, 1)\nassert next_date(2023, 2, 28) == (2023, 3, 1)"),
    "files-top-names": ("handles an archive with no matching files", "import os\ndirectory = '/tmp/top_names_empty'\nos.makedirs(directory, exist_ok=True)\nassert annual_top_names(directory) == ([], [])"),
    "files-popular-range": ("reports missing annual data", "import os\ndirectory = '/tmp/popular_missing'\nos.makedirs(directory, exist_ok=True)\ntry:\n    most_popular_names(directory, 2000, 2000)\n    assert False, 'Expected FileNotFoundError.'\nexcept FileNotFoundError:\n    pass"),
    "files-redaction": ("supports an empty sensitive-word list", "source = '/tmp/redact_plain.txt'\nsensitive = '/tmp/redact_empty.txt'\nout = '/tmp/redact_plain_out.txt'\nopen(source, 'w').write('Nothing changes.\\n')\nopen(sensitive, 'w').close()\nassert redact_file(source, sensitive, out) == 0\nassert open(out).read() == 'Nothing changes.\\n'"),
    "files-reflow": ("keeps words that exactly fit the width", "path = '/tmp/reflow_exact.txt'\nopen(path, 'w').write('abcd efgh')\nassert reflow_file(path, 9) == 'abcd efgh'"),
    "basics-earth-distance": ("handles antipodal points", "actual = earth_distance(0, 0, 0, 180)\nassert abs(actual - 20015.116796020572) < 1e-9"),
    "basics-gas-moles": ("scales linearly with pressure", "base = gas_moles(100000, 10, 300)\ndoubled = gas_moles(200000, 10, 300)\nassert abs(doubled - 2 * base) < 1e-12"),
    "functions-convert-base": ("accepts lowercase source digits", "assert convert_base('ff', 16, 10) == '255'\nassert convert_base('255', 10, 16) == 'FF'"),
}


def main() -> None:
    remaining = set(ADDITIONS)
    for path in (ROOT / "problems").glob("*.json"):
        catalog = json.loads(path.read_text())
        changed = False
        for problem in catalog.get("problems", []):
            if problem["id"] not in ADDITIONS:
                continue
            name, code = ADDITIONS[problem["id"]]
            ast.parse(code)
            if not any(test["name"] == name for test in problem["tests"]):
                problem["tests"].append({"name": name, "stdin": "", "moduleMode": True, "code": code})
                changed = True
            remaining.discard(problem["id"])
        if changed:
            path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    if remaining:
        raise RuntimeError(f"Unknown problem ids: {sorted(remaining)}")


if __name__ == "__main__":
    main()
