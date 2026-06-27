"""
auth.py — Comptes utilisateurs, tokens et persistance de session.
Zéro dépendance externe : stdlib uniquement (hmac, hashlib, sqlite3, uuid).
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import uuid
from pathlib import Path

AUTH_DB = Path(__file__).parent.parent / "data" / "users.db"
_SECRET = os.getenv("TANGA_SECRET_KEY", "tanga-dev-secret-change-in-prod")
_TOKEN_TTL = 30 * 24 * 3600  # 30 jours


# ── Base de données ────────────────────────────────────────────────────────────

def _conn() -> sqlite3.Connection:
    AUTH_DB.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(str(AUTH_DB))
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            email      TEXT UNIQUE NOT NULL COLLATE NOCASE,
            pass_hash  TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            user_id     TEXT PRIMARY KEY,
            session_id  TEXT NOT NULL,
            profil_pme  TEXT NOT NULL,
            last_results TEXT,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.commit()
    return c


# ── Mots de passe ──────────────────────────────────────────────────────────────

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}:{key.hex()}"


def _check_password(password: str, stored: str) -> bool:
    try:
        salt, key_hex = stored.split(":", 1)
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


# ── Tokens HMAC ────────────────────────────────────────────────────────────────

def create_token(user_id: str) -> str:
    exp = int(time.time()) + _TOKEN_TTL
    payload = f"{user_id}|{exp}"
    sig = hmac.new(_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}|{sig}".encode()).decode()


def verify_token(token: str) -> str | None:
    """Retourne user_id si le token est valide et non expiré, sinon None."""
    try:
        raw = base64.urlsafe_b64decode(token.encode() + b"==").decode()
        user_id, exp_str, sig = raw.split("|", 2)
        if int(exp_str) < int(time.time()):
            return None
        expected = hmac.new(_SECRET.encode(), f"{user_id}|{exp_str}".encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        return user_id
    except Exception:
        return None


# ── Utilisateurs ───────────────────────────────────────────────────────────────

def register_user(email: str, password: str) -> dict:
    """Crée un compte. Lève ValueError si l'email est déjà pris."""
    if len(password) < 6:
        raise ValueError("Le mot de passe doit contenir au moins 6 caractères.")
    user_id = str(uuid.uuid4())
    with _conn() as c:
        try:
            c.execute(
                "INSERT INTO users (id, email, pass_hash) VALUES (?, ?, ?)",
                (user_id, email.strip(), _hash_password(password)),
            )
        except sqlite3.IntegrityError:
            raise ValueError("Cet email est déjà utilisé.")
    return {"user_id": user_id, "email": email.strip().lower()}


def login_user(email: str, password: str) -> dict | None:
    """Valide les credentials. Retourne {user_id, email} ou None si invalide."""
    c = _conn()
    row = c.execute(
        "SELECT id, pass_hash FROM users WHERE email = ? COLLATE NOCASE",
        (email.strip(),),
    ).fetchone()
    c.close()
    if not row or not _check_password(password, row[1]):
        return None
    return {"user_id": row[0], "email": email.strip().lower()}


# ── Session persistante ────────────────────────────────────────────────────────

def save_user_session(
    user_id: str,
    session_id: str,
    profil_pme: dict,
    last_results: dict,
) -> None:
    """Sauvegarde ou met à jour la session active de l'utilisateur."""
    with _conn() as c:
        c.execute("""
            INSERT OR REPLACE INTO user_sessions
            (user_id, session_id, profil_pme, last_results, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        """, (user_id, session_id, json.dumps(profil_pme), json.dumps(last_results)))


def get_user_by_id(user_id: str) -> dict | None:
    """Retourne {user_id, email} ou None."""
    c = _conn()
    row = c.execute("SELECT email FROM users WHERE id = ?", (user_id,)).fetchone()
    c.close()
    return {"user_id": user_id, "email": row[0]} if row else None


def get_user_last_session(user_id: str) -> dict | None:
    """Retourne la dernière session persistée ou None."""
    c = _conn()
    row = c.execute(
        "SELECT session_id, profil_pme, last_results FROM user_sessions WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    c.close()
    if not row:
        return None
    return {
        "session_id": row[0],
        "profil_pme": json.loads(row[1]),
        "last_results": json.loads(row[2]) if row[2] else None,
    }
