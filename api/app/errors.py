"""Errors the web app can tell apart. Every one becomes {"code": ..., "message": ...}."""

from fastapi import HTTPException


def problem(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def not_configured(what: str) -> HTTPException:
    return problem(503, "not_configured", f"{what} is not set up on the API yet")
