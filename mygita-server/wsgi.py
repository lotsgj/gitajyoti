"""WSGI entry point for a real WSGI server (e.g. PythonAnywhere's manual
Flask configuration), as opposed to `dev_server.py`'s interactive CLI.

Configuration comes entirely from environment variables, since a WSGI file
has no command-line arguments to read:

- `MYGITA_JWT_SECRET` (required, no fallback -- see below)
- `MYGITA_ALLOWED_ORIGINS` (comma-separated; defaults same as dev_server.py)
- `MYGITA_STORE_BACKEND` (`json` or `sqlite`; defaults to `json`)

Unlike `dev_server.py`, this does not fall back to a randomly generated
secret when `MYGITA_JWT_SECRET` is unset. That fallback is a safe
convenience for a single local dev process; here it would be actively
wrong, since a real WSGI server commonly runs multiple worker processes --
each would generate its own secret, and a session token minted by one
worker would be silently rejected by another. Production must set an
explicit, stable secret.
"""

import os

from api import create_app

HERE = os.path.dirname(os.path.abspath(__file__))

_secret = os.environ.get("MYGITA_JWT_SECRET")
if not _secret:
    raise RuntimeError(
        "MYGITA_JWT_SECRET must be set. Unlike dev_server.py, wsgi.py does not "
        "generate a random per-process fallback -- a real WSGI server usually "
        "runs multiple worker processes, and each would mint a different, "
        "mutually-incompatible secret."
    )

_origins = os.environ.get("MYGITA_ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000").split(",")

_store = None  # create_app defaults this to JsonStore
if os.environ.get("MYGITA_STORE_BACKEND", "json") == "sqlite":
    from api.sqlite_store import SqliteStore

    _store = SqliteStore(os.path.join(HERE, "mock-data"), os.path.join(HERE, "runtime-data", "state.db"))

application = create_app(
    os.path.join(HERE, "mock-data"),
    os.path.join(HERE, "runtime-data"),
    _secret,
    allowed_origins={origin.strip() for origin in _origins if origin.strip()},
    store=_store,
)
