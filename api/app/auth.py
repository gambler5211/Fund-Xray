"""Checks the Supabase sign-in token sent by the web app.

The web app sends `Authorization: Bearer <access token>`. Supabase signs these tokens with a
private key and publishes the matching public keys at /auth/v1/.well-known/jwks.json, so the API
can check them without any secret and without calling Supabase on every request.
"""

from dataclasses import dataclass, field
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

ALGORITHMS = ["ES256", "RS256"]  # Supabase's asymmetric signing keys
AUDIENCE = "authenticated"

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class User:
    id: str
    email: str | None
    # The raw sign-in token, passed on to Supabase so its row-level security applies to calls
    # the API makes for this user. Kept out of repr so it never lands in a log line.
    token: str = field(default="", repr=False)


@lru_cache(maxsize=1)
def jwks_client() -> jwt.PyJWKClient:
    if not settings.supabase_jwks_url:
        raise RuntimeError("SUPABASE_URL is not set")
    # Keys are cached for 10 minutes; a token signed with a new key triggers a refetch.
    return jwt.PyJWKClient(settings.supabase_jwks_url, cache_keys=True, lifespan=600, timeout=5)


def _reject(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_token(token: str) -> User:
    try:
        key = jwks_client().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=ALGORITHMS,
            audience=AUDIENCE,
            issuer=settings.supabase_issuer,
            options={"require": ["exp", "sub", "aud", "iss"]},
            leeway=30,
        )
    except jwt.PyJWKClientConnectionError:
        # Couldn't fetch Supabase's public keys: our problem, not a bad token.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Can't reach Supabase to check sign-in") from None
    except jwt.ExpiredSignatureError:
        raise _reject("Sign-in expired") from None
    except (jwt.PyJWTError, jwt.PyJWKClientError):
        raise _reject("Invalid sign-in token") from None
    return User(id=claims["sub"], email=claims.get("email"), token=token)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> User:
    """FastAPI dependency: the signed-in user, or 401."""
    if not settings.supabase_url:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Sign-in checks are not configured")
    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials:
        raise _reject("Not signed in")
    return verify_token(creds.credentials)
