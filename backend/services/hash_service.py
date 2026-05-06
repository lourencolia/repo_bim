import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# Parâmetros Argon2id (OWASP 2024):
#   time_cost=3   → 3 passagens sobre a memória
#   memory_cost   → 64 MiB por hash (dificulta ataques com GPU)
#   parallelism=2 → ajuste conforme o número de núcleos do servidor
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MiB
    parallelism=2,
    hash_len=32,
    salt_len=32,
)

# 32 bytes = 256 bits — salt único por usuário, armazenado em coluna separada
_SALT_BYTES = 32


def generate_salt() -> str:
    """Gera um salt criptograficamente seguro (hex de 64 caracteres)."""
    return secrets.token_hex(_SALT_BYTES)


def hash_password(password: str, salt: str) -> str:
    """Retorna o hash Argon2id de (salt + senha)."""
    return _hasher.hash(salt + password)


def verify_password(password: str, salt: str, password_hash: str) -> bool:
    """Verifica a senha usando comparação em tempo constante."""
    try:
        return _hasher.verify(password_hash, salt + password)
    except VerifyMismatchError:
        return False
    except (VerificationError, InvalidHashError):
        return False
