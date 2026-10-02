#!/bin/sh
# Existing no-agent poll; no new schedule and no inference for an idle queue.
export HELENA_DISPATCH_ENABLED=1
python /data/helena-runtime/hermes_queue_watchdog.py --execute >/dev/null || true
exec python /data/helena-runtime/hermes_pipeline.py --execute --max-actions 6
