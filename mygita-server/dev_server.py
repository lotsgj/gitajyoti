#!/usr/bin/env python3
"""Run the My Gita mock API for local client development."""

import argparse
import os

from api import create_server


def main():
    parser = argparse.ArgumentParser(description="Run the My Gita local mock API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8081, type=int)
    args = parser.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    secret = os.environ.get("MYGITA_DEV_JWT_SECRET", "mygita-local-development-secret-change-me")
    origins = os.environ.get("MYGITA_DEV_ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000").split(",")
    server = create_server(
        args.host,
        args.port,
        os.path.join(here, "mock-data"),
        os.path.join(here, "runtime-data"),
        secret,
        allowed_origins={origin.strip() for origin in origins if origin.strip()},
    )
    print("My Gita mock API: http://%s:%s/api/v1" % (args.host, server.server_port))
    print("Prototype OTP: 123456")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping My Gita mock API")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
