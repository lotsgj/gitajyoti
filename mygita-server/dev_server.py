#!/usr/bin/env python3
"""Run the My Gita mock/production API for local client development."""

import argparse
import os
import secrets

from api import create_app


def main():
    parser = argparse.ArgumentParser(description="Run the My Gita local mock API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8081, type=int)
    parser.add_argument(
        "--store",
        choices=["json", "sqlite"],
        default="json",
        help="Persistence backend (default: json, the existing JsonStore; "
        "sqlite uses api.sqlite_store.SqliteStore against runtime-data/state.db)",
    )
    args = parser.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    secret = os.environ.get("MYGITA_DEV_JWT_SECRET")
    if not secret:
        # No hardcoded fallback: a fixed, git-committed default secret would let
        # anyone forge a valid session token for any user if this server is ever
        # reached by something other than its author. Generate a fresh, random
        # secret per process instead -- local dev still works with zero setup,
        # but sessions do not survive a restart, and nothing predictable ever
        # ships in source control.
        secret = secrets.token_urlsafe(32)
        print("No MYGITA_DEV_JWT_SECRET set -- using a randomly generated secret for this process.")
        print("Sessions will not survive a restart. Set MYGITA_DEV_JWT_SECRET for a stable secret.")
    origins = os.environ.get("MYGITA_DEV_ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000").split(",")
    store = None  # create_app defaults this to JsonStore
    if args.store == "sqlite":
        from api.sqlite_store import SqliteStore

        store = SqliteStore(os.path.join(here, "mock-data"), os.path.join(here, "runtime-data", "state.db"))
    app = create_app(
        os.path.join(here, "mock-data"),
        os.path.join(here, "runtime-data"),
        secret,
        allowed_origins={origin.strip() for origin in origins if origin.strip()},
        store=store,
    )
    print("My Gita mock API: http://%s:%s/api/v1" % (args.host, args.port))
    print("Store backend: %s" % args.store)
    print("Prototype OTP: 123456")
    try:
        app.run(host=args.host, port=args.port, threaded=True)
    except KeyboardInterrupt:
        print("\nStopping My Gita mock API")
    finally:
        app.mygita.store.close()


if __name__ == "__main__":
    main()
