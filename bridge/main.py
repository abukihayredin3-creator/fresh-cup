"""Bridge entrypoint.

Run with: python -m bridge.main
"""

from __future__ import annotations

import uvicorn

from bridge.app import app
from bridge.config import CONFIG


def main() -> None:
    uvicorn.run(app, host=CONFIG.host, port=CONFIG.port)


if __name__ == "__main__":
    main()
