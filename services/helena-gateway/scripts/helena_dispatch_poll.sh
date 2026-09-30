#!/bin/sh
# Hermes cron --no-agent entrypoint. Queue reads consume no model tokens.
# A Marina dispatch request or current audited manager release unlocks one run.
export HELENA_DISPATCH_ENABLED=1
result=$(python /data/helena-runtime/hermes_dispatch_once.py --auto --execute 2>&1)
code=$?
if [ "$code" -ne 0 ]; then
  printf '%s\n' "$result"
  exit "$code"
fi
case "$result" in
  *'"status": "NO_DISPATCH_REQUEST"'*|*'"status": "NO_APPROVED_READY_JOB"'*|*'"status": "WAITING_HELENA"'*)
    # One bounded review/continuation after dispatch. Same global lock, no new cron.
    python /data/helena-runtime/hermes_workflow_tick.py --execute
    exit $? ;;
  *) printf '%s\n' "$result" ;;
esac
