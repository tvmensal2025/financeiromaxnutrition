#!/bin/sh
# Hermes cron --no-agent entrypoint. Queue reads consume no model tokens.
# Only a Marina DISPATCH_REQUESTED event unlocks one bounded run per tick.
export HELENA_DISPATCH_ENABLED=1
result=$(python /data/helena-runtime/hermes_dispatch_once.py --auto --execute 2>&1)
code=$?
if [ "$code" -ne 0 ]; then
  printf '%s\n' "$result"
  exit "$code"
fi
case "$result" in
  *'"status": "NO_DISPATCH_REQUEST"'*|*'"status": "NO_APPROVED_READY_JOB"'*) exit 0 ;;
  *) printf '%s\n' "$result" ;;
esac
