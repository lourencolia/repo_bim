import base64
from io import BytesIO

import pyotp
import qrcode

from backend.config import settings


def generate_totp_secret() -> str:
    """Gera um segredo TOTP base32 aleatório e seguro."""
    return pyotp.random_base32()


def generate_qr_code_base64(email: str, secret: str) -> str:
    """Gera o QR Code TOTP e retorna como string base64 (PNG)."""
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=email, issuer_name=settings.TOTP_ISSUER_NAME)

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


def verify_totp(secret: str, code: str) -> bool:
    """Verifica o código TOTP com tolerância de ±30s de drift de relógio."""
    return pyotp.TOTP(secret).verify(code, valid_window=1)
