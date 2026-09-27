// Reconcile only sessions that existed before the remote snapshot was requested.
export async function reconcilePhoneCalls({ listLocal, listRemote, endCall, now = Date.now() }) {
  const normalize = id => String(id).trim().toUpperCase();
  const candidates = listLocal().filter(call => !normalize(call.call_id).startsWith("WEB-") && now - Date.parse(call.started_at) > 30000);
  if (!candidates.length) return;
  const remote = await listRemote();
  const active = new Set(remote.filter(call => !['ENDED', 'COMPLETED', 'FAILED'].includes(call.status)).map(call => normalize(call.call_id)));
  for (const call of candidates) {
    if (!active.has(normalize(call.call_id))) await endCall({ call_id: call.call_id, reason: 'transport_disconnected' });
  }
}
