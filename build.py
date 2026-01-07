#!/usr/bin/env python3
"""
DreamShop Build Script

Combines HTML partials into a single dist/index.html file.
No dependencies required - uses only Python standard library.

Usage:
    python build.py          # Build once
    python build.py --watch  # Watch for changes and rebuild
"""

import re
import sys
import time
from pathlib import Path

# Configuration
SRC_DIR = Path('src')
DIST_DIR = Path('dist')
ENTRY_FILE = SRC_DIR / 'index.html'
OUTPUT_FILE = DIST_DIR / 'index.html'

# Regex to match <!-- include:path/to/file.html -->
INCLUDE_PATTERN = re.compile(r'<!-- include:(.+?) -->')


def read_file(path: Path) -> str:
    """Read file contents, exit with error if not found."""
    try:
        return path.read_text(encoding='utf-8')
    except FileNotFoundError:
        print(f'Error: File not found: {path}')
        sys.exit(1)


def replace_include(match: re.Match) -> str:
    """Replace an include directive with the file contents."""
    include_path = match.group(1).strip()
    file_path = SRC_DIR / include_path
    return read_file(file_path)


def build() -> bool:
    """
    Build the dist/index.html from src/index.html and partials.
    Returns True if successful.
    """
    # Read the entry file
    content = read_file(ENTRY_FILE)

    # Replace all includes
    output = INCLUDE_PATTERN.sub(replace_include, content)

    # Ensure dist directory exists
    DIST_DIR.mkdir(exist_ok=True)

    # Write output
    OUTPUT_FILE.write_text(output, encoding='utf-8')

    return True


def get_all_source_files() -> list[Path]:
    """Get all HTML files in src directory."""
    return list(SRC_DIR.rglob('*.html'))


def get_mtimes(files: list[Path]) -> dict[Path, float]:
    """Get modification times for all files."""
    mtimes = {}
    for f in files:
        try:
            mtimes[f] = f.stat().st_mtime
        except FileNotFoundError:
            pass
    return mtimes


def watch():
    """Watch for file changes and rebuild."""
    print('Watching for changes... (Ctrl+C to stop)')

    last_mtimes = get_mtimes(get_all_source_files())

    try:
        while True:
            time.sleep(0.5)

            current_files = get_all_source_files()
            current_mtimes = get_mtimes(current_files)

            # Check for changes
            changed = False
            for f, mtime in current_mtimes.items():
                if f not in last_mtimes or last_mtimes[f] != mtime:
                    changed = True
                    break

            # Check for new files
            if set(current_mtimes.keys()) != set(last_mtimes.keys()):
                changed = True

            if changed:
                print(f'\n[{time.strftime("%H:%M:%S")}] Change detected, rebuilding...')
                try:
                    build()
                    print(f'✓ Built {OUTPUT_FILE}')
                except Exception as e:
                    print(f'✗ Build failed: {e}')

                last_mtimes = current_mtimes

    except KeyboardInterrupt:
        print('\nStopped watching.')


def main():
    # Parse arguments
    watch_mode = '--watch' in sys.argv or '-w' in sys.argv

    # Initial build
    print('Building DreamShop...')
    try:
        build()
        print(f'✓ Built {OUTPUT_FILE}')
    except Exception as e:
        print(f'✗ Build failed: {e}')
        sys.exit(1)

    # Watch mode
    if watch_mode:
        watch()


if __name__ == '__main__':
    main()
