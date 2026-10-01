const missingRemoteSnapshots = new Map();
const latestRemoteSnapshots = new Map();
let remoteSnapshotSequence = 0;
const MIN_MISSING_INTERVAL_MS = 15_000;

// Treat one remote snapshot omission as transient; require a later successful
// snapshot to confirm that the transport really disappeared before closing AI state.
export async function reconcilePhoneCalls({ listLocal, listRemote, endCall, now = Date.now() }) {
  const normalize = id => String(id || '').trim().toUpperCase();
  const instance = call => call.call_instance_id || call.started_at;
  const localCalls = listLocal();
  const localIds = new Set(localCalls.map(call => normalize(call.call_id)).filter(Boolean));
  for (const callId of missingRemoteSnapshots.keys()) {
    if (!localIds.has(callId)) missingRemoteSnapshots.delete(callId);
  }
  for (const callId of latestRemoteSnapshots.keys()) {
    if (!localIds.has(callId)) latestRemoteSnapshots.delete(callId);
  }

  const candidates = localCalls.filter(call => {
    const callId = normalize(call.call_id);
    const startedAt = Date.parse(call.started_at);
    return callId && !callId.startsWith('WEB-') && Number.isFinite(startedAt) && now - startedAt > 30000;
  });
  if (!candidates.length) return;
  const snapshotSequence = ++remoteSnapshotSequence;
  const remote = await listRemote();
  const active = new Set(remote
    .filter(call => !['ENDED', 'COMPLETED', 'FAILED', 'REJECTED'].includes(String(call.status || '').toUpperCase()))
    .map(call => normalize(call.call_id)));
  for (const call of candidates) {
    const callId = normalize(call.call_id);
    // A new session can reuse the transport ID while the remote request is in flight.
    const current = listLocal().find(local => normalize(local.call_id) === callId);
    if (!current || instance(current) !== instance(call)) continue;
    const latest = latestRemoteSnapshots.get(callId);
    if (latest?.instance === instance(call) && latest.sequence > snapshotSequence) continue;
    latestRemoteSnapshots.set(callId, {instance: instance(call), sequence: snapshotSequence});
    if ([call.call_id, ...(current.call_aliases || [])].some(id => active.has(normalize(id)))) {
      missingRemoteSnapshots.delete(callId);
      continue;
    }

    const prior = missingRemoteSnapshots.get(callId);
    if (!prior || prior.instance !== instance(call)) {
      missingRemoteSnapshots.set(callId, { instance: instance(call), firstMissingAt: now, lastMissingAt: now, confirmations: 1 });
      continue;
    }
    if (now - prior.lastMissingAt < MIN_MISSING_INTERVAL_MS) continue;

    prior.lastMissingAt = now;
    prior.confirmations += 1;
    if (prior.confirmations >= 2 && now - prior.firstMissingAt >= MIN_MISSING_INTERVAL_MS) {
      missingRemoteSnapshots.delete(callId);
      await endCall({ call_id: call.call_id, reason: 'transport_disconnected' });
    }
  }
}
