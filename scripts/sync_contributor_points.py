#!/usr/bin/env python3
"""Build dashboard priority data from the email base and Lawnicons point files.

Reads every contribution-points/contributors/*.txt in the Lawnicons checkout and writes:
  - src/assets/iconsyouneedmost.json  (email base + active spends)
  - src/assets/contributor_points.json (earned/spent/boosted/balance + avatar accent)
  - src/assets/avatars/*.webp          (GitHub avatars for the leaderboard)

Only the `spends` section affects priorities. `fulfilled` and `awards` are
accounting history and are ignored by the dashboard aggregate. Avatar downloads
are skipped in --check mode; missing avatars are non-fatal and get a UI fallback.
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

AVATAR_TIMEOUT = 20
# Keep in sync with --secondary-rgb in src/styles.css.
DEFAULT_ACCENT = (188, 199, 219)
RANKS = ("5", "4", "3", "2", "1")
HEADER_KEYS = ("earned", "spent", "balance")
SECTIONS = ("spends", "fulfilled", "awards")
LOGIN_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])")
APP_ID_RE = re.compile(
    r"[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+/[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+",
    re.IGNORECASE,
)
AWARD_RE = re.compile(
    r"\+(\d+)\s+points\s+for\s+pr\s+(\d+)\s+with\s+(\d+)\s+"
    r"(?:icons?/updates?|icons?|updates?)"
)


class FormatError(ValueError):
    pass


@dataclass(frozen=True)
class Spend:
    app_id: str
    weight: int


@dataclass(frozen=True)
class Contributor:
    login: str
    earned: int
    spent: int
    balance: int
    boosted: int
    spends: tuple[Spend, ...]


def parse_contributor(path: Path, seen_prs: set[int]) -> Contributor:
    login = path.stem
    if not LOGIN_RE.fullmatch(login):
        raise FormatError(f"{path}: invalid GitHub login in file name: {login!r}")

    lines = path.read_text(encoding="utf-8").splitlines()
    while lines and lines[-1] == "":
        lines.pop()

    if len(lines) < 9:
        raise FormatError(f"{path}: expected header and three sections")

    header: dict[str, int] = {}
    for index, key in enumerate(HEADER_KEYS):
        match = re.fullmatch(rf"{key} (\d+)", lines[index])
        if not match:
            raise FormatError(f"{path}:{index + 1}: expected '{key} <integer>'")
        header[key] = int(match.group(1))
    if lines[3] != "":
        raise FormatError(f"{path}:4: expected a blank line after the header")

    sections: dict[str, list[tuple[int, str]]] = {}
    position = 4
    for index, name in enumerate(SECTIONS):
        if position >= len(lines) or lines[position] != name:
            raise FormatError(f"{path}:{position + 1}: expected '{name}' section")
        position += 1
        entries: list[tuple[int, str]] = []
        while position < len(lines) and lines[position] != "":
            entries.append((position + 1, lines[position]))
            position += 1
        sections[name] = entries
        if index < len(SECTIONS) - 1:
            if position >= len(lines) or lines[position] != "":
                raise FormatError(f"{path}:{position + 1}: expected blank line after '{name}'")
            position += 1
        elif position != len(lines):
            raise FormatError(f"{path}:{position + 1}: unexpected lines after '{name}'")

    earned = 0
    for line_number, line in sections["awards"]:
        if line.lstrip().startswith("#"):
            continue
        match = AWARD_RE.fullmatch(line)
        if not match:
            raise FormatError(
                f"{path}:{line_number}: expected '+<points> points for pr <n> "
                "with <count> icon(s)/update(s)'"
            )
        points, pr, count = (int(match.group(i)) for i in (1, 2, 3))
        if points != count * 5:
            raise FormatError(f"{path}:{line_number}: points must equal 5 × count")
        if pr in seen_prs:
            raise FormatError(f"{path}:{line_number}: duplicate PR award #{pr}")
        seen_prs.add(pr)
        earned += points

    seen_app_ids: set[str] = set()

    def parse_spends(section: str) -> tuple[Spend, ...]:
        result = []
        for line_number, line in sections[section]:
            if line.lstrip().startswith("#"):
                continue
            parts = line.split()
            if len(parts) != 2:
                raise FormatError(f"{path}:{line_number}: expected '<appID> <weight>'")
            app_id, raw_weight = parts
            if not APP_ID_RE.fullmatch(app_id):
                raise FormatError(f"{path}:{line_number}: invalid app ID: {app_id!r}")
            if app_id in seen_app_ids:
                raise FormatError(f"{path}:{line_number}: duplicate app ID: {app_id}")
            seen_app_ids.add(app_id)
            if not raw_weight.isdigit():
                raise FormatError(f"{path}:{line_number}: invalid weight: {raw_weight!r}")
            weight = int(raw_weight)
            if weight <= 0 or (weight > 5 and weight % 5):
                raise FormatError(
                    f"{path}:{line_number}: weight must be 1-5 or a multiple of 5"
                )
            result.append(Spend(app_id, weight))
        return tuple(result)

    spends = parse_spends("spends")
    fulfilled = parse_spends("fulfilled")
    spent = sum(item.weight for item in spends + fulfilled)
    boosted = len(spends) + len(fulfilled)
    balance = earned - spent
    if balance < 0:
        raise FormatError(f"{path}: balance is negative ({balance})")

    expected = {"earned": earned, "spent": spent, "balance": balance}
    if header != expected:
        raise FormatError(f"{path}: header {header} does not match events {expected}")

    return Contributor(login, earned, spent, balance, boosted, spends)


def resolve_points_dir(root: Path) -> Path:
    """Prefer contributors/, fall back to the legacy flat layout."""
    nested = root / "contribution-points" / "contributors"
    if any(nested.glob("*.txt")):
        return nested
    return root / "contribution-points"


def load_contributors(points_dir: Path) -> tuple[Contributor, ...]:
    if not points_dir.is_dir():
        raise FormatError(f"Lawnicons points directory not found: {points_dir}")

    seen_prs: set[int] = set()
    contributors = []
    for path in sorted(points_dir.glob("*.txt")):
        contributors.append(parse_contributor(path, seen_prs))
    return tuple(contributors)


def sync_avatars(contributors: tuple[Contributor, ...], avatars_dir: Path) -> None:
    """Download original-size GitHub avatars as WebP; the UI scales them down."""
    try:
        import requests
        from PIL import Image
    except ImportError as error:
        raise FormatError(f"avatar sync requires requests and Pillow: {error}")

    session = requests.Session()
    session.headers.update({"User-Agent": "lawnicons-dashboard-sync"})
    avatars_dir.mkdir(parents=True, exist_ok=True)
    expected: set[str] = set()

    for contributor in contributors:
        filename = f"{contributor.login}.webp"
        expected.add(filename)
        path = avatars_dir / filename
        try:
            response = session.get(
                f"https://github.com/{contributor.login}.png",
                timeout=AVATAR_TIMEOUT,
            )
            if response.status_code == 404:
                print(
                    f"warning: no GitHub avatar for {contributor.login}",
                    file=sys.stderr,
                )
                continue
            response.raise_for_status()
            with Image.open(BytesIO(response.content)) as image:
                if min(image.size) < 56:
                    print(
                        f"warning: no usable GitHub avatar for {contributor.login}",
                        file=sys.stderr,
                    )
                    path.unlink(missing_ok=True)
                    continue
                buffer = BytesIO()
                image.convert("RGB").save(buffer, format="WEBP", quality=100, method=6)
                content = buffer.getvalue()
        except Exception as error:
            print(
                f"warning: could not sync avatar for {contributor.login}: {error}",
                file=sys.stderr,
            )
            continue

        if not path.exists() or path.read_bytes() != content:
            path.write_bytes(content)

    for stale in avatars_dir.glob("*.webp"):
        if stale.name not in expected:
            stale.unlink()


def load_avatar_accents(
    contributors: tuple[Contributor, ...], avatars_dir: Path
) -> dict[str, tuple[int, int, int]]:
    """Read a dominant avatar color for each leaderboard card gradient."""
    try:
        from PIL import Image
    except ImportError:
        return {}

    accents: dict[str, tuple[int, int, int]] = {}
    for contributor in contributors:
        path = avatars_dir / f"{contributor.login}.webp"
        if not path.exists():
            continue
        try:
            with Image.open(path) as image:
                sample = image.convert("RGB")
                sample.thumbnail((32, 32))
                quantized = sample.quantize(colors=8)
                palette = quantized.getpalette() or []
                candidates: list[tuple[int, int, tuple[int, int, int]]] = []
                for count, index in quantized.getcolors() or []:
                    offset = index * 3
                    values = tuple(palette[offset : offset + 3])
                    if len(values) != 3:
                        continue
                    color = (values[0], values[1], values[2])
                    brightness = sum(color) / 3
                    penalty = 0 if 60 <= brightness <= 225 else 1
                    candidates.append((count, penalty, color))
                if not candidates:
                    continue
                _, _, accent = max(
                    candidates, key=lambda item: (item[1] == 0, item[0])
                )
                accents[contributor.login] = accent
        except (OSError, ValueError):
            continue
    return accents


def load_email_base(path: Path) -> dict[str, list[str]]:
    if not path.exists():
        raise FormatError(f"email priority base not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise FormatError(f"{path}: expected a JSON object")
    for rank in RANKS:
        value = data.get(rank, [])
        if not isinstance(value, list):
            raise FormatError(f"{path}: '{rank}' must be an array")
    return data


def priority_bucket(weight: int) -> tuple[str, int]:
    if weight <= 5:
        return str(weight), 1
    return "5", weight // 5


def build_outputs(
    email_base: dict[str, list[str]],
    contributors: tuple[Contributor, ...],
    accents: dict[str, tuple[int, int, int]],
) -> tuple[dict[str, list[str]], dict[str, dict[str, int | list[int]]]]:
    priorities = {rank: list(email_base.get(rank, [])) for rank in RANKS}
    summary: dict[str, dict[str, int | list[int]]] = {}

    for contributor in contributors:
        summary[contributor.login] = {
            "earned": contributor.earned,
            "spent": contributor.spent,
            "boosted": contributor.boosted,
            "balance": contributor.balance,
            "accent": list(accents.get(contributor.login, DEFAULT_ACCENT)),
        }
        for spend in contributor.spends:
            rank, count = priority_bucket(spend.weight)
            priorities[rank].extend([spend.app_id] * count)

    return priorities, summary


def serialize(data: object) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def write_or_check(path: Path, data: object, check: bool, errors: list[str]) -> None:
    content = serialize(data)
    if check:
        if not path.exists():
            errors.append(f"missing generated file: {path}")
        elif path.read_text(encoding="utf-8") != content:
            errors.append(f"generated file is out of date: {path}")
        return
    if path.exists() and path.read_text(encoding="utf-8") == content:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--lawnicons",
        type=Path,
        default=Path(os.environ.get("LAWNICONS_DIR", "../9136")),
        help="Lawnicons checkout containing contribution-points/contributors/",
    )
    parser.add_argument(
        "--base",
        type=Path,
        default=Path("src/assets/iconsyouneedmost_emails.json"),
        help="email-generated priority base",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/assets/iconsyouneedmost.json"),
        help="final priorities file consumed by the dashboard",
    )
    parser.add_argument(
        "--summary",
        type=Path,
        default=Path("src/assets/contributor_points.json"),
        help="derived earned/spent/balance summary for the leaderboard",
    )
    parser.add_argument(
        "--avatars-dir",
        type=Path,
        default=Path("src/assets/avatars"),
        help="directory for downloaded GitHub avatars",
    )
    parser.add_argument(
        "--skip-avatars",
        action="store_true",
        help="do not download avatars",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="only verify that generated files are up to date",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        contributors = load_contributors(resolve_points_dir(args.lawnicons))
        email_base = load_email_base(args.base)
    except (FormatError, json.JSONDecodeError, OSError, UnicodeDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if not args.check and not args.skip_avatars:
        try:
            sync_avatars(contributors, args.avatars_dir)
        except FormatError as error:
            print(f"error: {error}", file=sys.stderr)
            return 1

    accents = load_avatar_accents(contributors, args.avatars_dir)
    priorities, summary = build_outputs(email_base, contributors, accents)

    errors: list[str] = []
    write_or_check(args.output, priorities, args.check, errors)
    write_or_check(args.summary, summary, args.check, errors)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1

    active = sum(len(item.spends) for item in contributors)
    if args.check:
        print(
            f"OK: {len(contributors)} contributor file(s), {active} active spend(s); "
            "generated files are up to date"
        )
    else:
        print(
            f"OK: {len(contributors)} contributor file(s), {active} active spend(s); "
            f"wrote {args.output} and {args.summary}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
