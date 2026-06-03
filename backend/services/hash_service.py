import logging
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

logger = logging.getLogger(__name__)

# Argon2id parameters (OWASP 2024):
#   time_cost=3   → 3 memory passes
#   memory_cost   → 64 MiB per hash (hardens against GPU attacks)
#   parallelism=2 → tune to available cores
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=2,
    hash_len=32,
    salt_len=32,
)

_SALT_BYTES = 32


def generate_salt() -> str:
    return secrets.token_hex(_SALT_BYTES)


def hash_password(password: str, salt: str) -> str:
    return _hasher.hash(salt + password)


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    """Constant-time comparison via Argon2 — never short-circuits on mismatch."""
    try:
        return _hasher.verify(password_hash, salt + password)
    except VerifyMismatchError:
        return False
    except (VerificationError, InvalidHashError) as exc:
        logger.error("Malformed password hash detected — possible data corruption: %s", exc)
        return False
