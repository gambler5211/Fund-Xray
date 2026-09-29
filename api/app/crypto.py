"""Encrypts Kite access tokens before they are stored, with a Fernet key held only by the API.

Fernet = AES-128 + HMAC. A wrong or corrupted ciphertext fails loudly instead of decrypting to
garbage. The key must be 44 characters of URL-safe base64 (32 random bytes). Generate one with:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.errors import not_configured

log = logging.getLogger(__name__)


class KeyProblem(Exception):
    pass


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = (settings.token_encryption_key or "").strip()
    if not key:
        raise KeyProblem("TOKEN_ENCRYPTION_KEY is not set")
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError):
        raise KeyProblem(
            f"TOKEN_ENCRYPTION_KEY is not a valid Fernet key (got {len(key)} characters; "
            "expected 44 characters of URL-safe base64 ending in '=')"
        ) from None


def key_status() -> str | None:
    """None if the key is usable, otherwise a message saying what's wrong. Checked at startup."""
    try:
        _fernet()
        return None
    except KeyProblem as e:
        return str(e)


def encrypt(plain: str) -> str:
    try:
        return _fernet().encrypt(plain.encode()).decode()
    except KeyProblem as e:
        log.error("%s", e)
        raise not_configured("The token encryption key") from None


def decrypt(cipher: str) -> str | None:
    """The plain token, or None if it can't be read (for example after the key was rotated)."""
    try:
        return _fernet().decrypt(cipher.encode()).decode()
    except KeyProblem as e:
        log.error("%s", e)
        raise not_configured("The token encryption key") from None
    except InvalidToken:
        return None
