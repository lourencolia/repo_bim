"""
Serviço de criptografia simétrica — AES-256-GCM.

Usado para:
  - Criptografar totp_secret antes de persistir no banco (3A)
  - Criptografar conteúdo de arquivos BIM antes de gravar no disco (3B)

A chave é derivada de SECRET_KEY via HKDF-SHA256 (RFC 5869),
garantindo separação criptográfica entre a chave JWT e a chave de cifração.
"""

import os
import base64

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

# ── Constantes ────────────────────────────────────────────────────────────────

_NONCE_SIZE  = 12           # 96 bits — recomendação NIST para AES-GCM
_KEY_SIZE    = 32           # 256 bits — AES-256
_TEXT_PREFIX = "enc:"       # prefixo em valores cifrados no banco
_FILE_MAGIC  = b"BIMENC\x01"  # cabeçalho em arquivos cifrados no disco (7 bytes)

# ── Chave derivada (singleton) ────────────────────────────────────────────────

_derived_key: bytes | None = None


def _get_key() -> bytes:
    """Deriva e armazena em cache a chave AES-256 a partir de SECRET_KEY."""
    global _derived_key
    if _derived_key is None:
        from backend.config import settings
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=_KEY_SIZE,
            salt=None,
            info=b"bim-repo-aes-encryption-v1",
        )
        _derived_key = hkdf.derive(settings.SECRET_KEY.encode())
    return _derived_key


# ── Texto (totp_secret) ───────────────────────────────────────────────────────

def encrypt_text(plaintext: str) -> str:
    """Cifra uma string com AES-256-GCM.

    Formato armazenado: 'enc:<base64(nonce || ciphertext_com_tag)>'
    O prefixo 'enc:' permite distinguir valores cifrados de legados (plain text).
    """
    aesgcm = AESGCM(_get_key())
    nonce  = os.urandom(_NONCE_SIZE)
    ct     = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return _TEXT_PREFIX + base64.b64encode(nonce + ct).decode()


def decrypt_text(value: str) -> str:
    """Decifra valor produzido por encrypt_text().

    Valores sem o prefixo 'enc:' são retornados como estão —
    compatibilidade com registros anteriores à criptografia em repouso.
    """
    if not value.startswith(_TEXT_PREFIX):
        return value  # registro legado — ainda em texto claro

    raw    = base64.b64decode(value[len(_TEXT_PREFIX):])
    nonce  = raw[:_NONCE_SIZE]
    ct     = raw[_NONCE_SIZE:]
    aesgcm = AESGCM(_get_key())
    return aesgcm.decrypt(nonce, ct, None).decode()


# ── Binário (arquivos BIM) ─────────────────────────────────────────────────────

def encrypt_bytes(data: bytes) -> bytes:
    """Cifra dados binários com AES-256-GCM.

    Formato gravado no disco: MAGIC (7 B) || nonce (12 B) || ciphertext_com_tag
    """
    aesgcm = AESGCM(_get_key())
    nonce  = os.urandom(_NONCE_SIZE)
    ct     = aesgcm.encrypt(nonce, data, None)
    return _FILE_MAGIC + nonce + ct


def decrypt_bytes(data: bytes) -> bytes:
    """Decifra dados produzidos por encrypt_bytes().

    Arquivos sem o cabeçalho BIMENC são retornados sem alteração —
    compatibilidade com uploads anteriores à criptografia em repouso.
    """
    if not data.startswith(_FILE_MAGIC):
        return data  # arquivo legado — não cifrado

    offset = len(_FILE_MAGIC)
    nonce  = data[offset: offset + _NONCE_SIZE]
    ct     = data[offset + _NONCE_SIZE:]
    aesgcm = AESGCM(_get_key())
    return aesgcm.decrypt(nonce, ct, None)
