/** One rule for initial turns and resuming after a profile change. */
export function isVoiceStreamingEnabled(env = process.env) {
  return String(env.CALL_VOICE_STREAMING_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
}
