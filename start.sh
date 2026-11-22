#!/bin/sh
set -eu
: "${SECRET_KEY:?Set a persistent secret key in the hosting environment}"
export TZ="${TZ:-Asia/Kolkata}"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
