import os
import ast
import re
from pathlib import Path

IGNORED_DIRS = {'.git', 'node_modules', '__pycache__', '.next', '.pytest_cache', '.agents'}
IGNORED_FILES = {'.DS_Store', 'package-lock.json', 'tsconfig.tsbuildinfo'}

def get_all_repo_files():
    file_list = []
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith('.')]
        for f in files:
            if f in IGNORED_FILES or f.startswith('.'):
                continue
            path = os.path.relpath(os.path.join(root, f), '.')
            file_list.append(path)
    return sorted(file_list)

all_files = get_all_repo_files()
print(f"Discovered {len(all_files)} files.")
