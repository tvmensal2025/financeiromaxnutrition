#!/bin/sh
# Existing hourly, no-agent poll; no new schedule and no inference for an idle queue.
export HELENA_DISPATCH_ENABLED=1
exec python /data/helena-runtime/hermes_pipeline.py --execute --max-actions 6
