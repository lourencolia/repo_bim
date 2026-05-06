"""
models/__init__.py
──────────────────
Exposes all ORM models from a single import point so that database/db.py
can import the package and SQLAlchemy's metadata picks up all table definitions.
"""

from backend.models.user import User  # noqa: F401
from backend.models.file import File, FileShare, FileAccessLog  # noqa: F401

__all__ = ["User", "File", "FileShare", "FileAccessLog"]
