# Voice latency adjustment — 2026-09-28

Scope: Helena call gateway and Meowcaller. GPT generates text; Google Chirp 3 HD generates all call audio. Existing ElevenLabs audio assets are unchanged.

## Changes

- Meowcaller closes short utterances after 12 silent 60ms frames (720ms), instead of 20 (1200ms). Speech resuming within that window resets the counter. Confirmed new speech still advances the epoch and interrupts pending/playing audio.
- Heard utterances are queued for persistence before generation, without awaiting remote writes. Writes retain per-call order and retry up to three times using the same `turn_id`; the existing context endpoint deduplicates that ID. This queue is in memory and does not survive process termination. No schema or function deployment is included.
- Caller context and a short Google PCM acknowledgement warm as incoming audio starts. Context/profile isolation is preserved.
- After input ends, a cached `Hum.` may play at 300ms if speech was recognized and the answer is not ready. No acknowledgement on silence, a cache miss, changed profile, cancelled turn, or within 10s of the previous cue. At most one per turn. PCM is keyed by resolved Google voice; cached clips longer than 1.5s are rejected rather than cut.
- GPT and Google generate the answer concurrently with an already-playing cue. The answer waits for cue playback completion before reserving the same Meowcaller stream; it does not compete with it.
- Meaningful clauses ending in comma, semicolon or colon can enter Google before the whole sentence. Decimal and abbreviation protections remain.
- `stt_ms` now reflects completion after commit, not the duration of the caller's speech. `input_end_to_first_audio_ms` measures gateway input completion to answer transport submission, excluding Meowcaller VAD and final VoIP delivery. `wait_cue_ms` measures cue submission separately. Neither is an end-to-end handset latency measurement.

## Validation

- Gateway automated suite covers blocked persistence, idempotent retry, output ordering, silent input, cache miss, active-voice isolation, cue cooldown, interruption, early clause delivery and transcription timing.
- Go voice tests cover 720ms endpoint, retained onset, half-second pauses, room noise and epoch invalidation on resumed speech.
- Real GPT + Google test, output to a local transport stub (no phone call): Google cached clip 6412 bytes / approximately 200ms; cue submitted at 302ms; answer PCM generated successfully. This is provider integration evidence, not a before/after WhatsApp benchmark.
- Windows Application Control blocked execution of the separate Go `tests` package; use Linux CI for the complete suite.

## Official references

- https://developers.openai.com/api/docs/guides/latency-optimization
- https://developers.openai.com/api/docs/guides/realtime-transcription
- https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd

Rollback: revert the gateway and Go commits separately. `CALL_BACKCHANNEL_ENABLED=false` disables optional cues; `CALL_STT_STREAMING_ENABLED=false` preserves the existing WAV recovery path. Validate with paired real calls before claiming a measured improvement in handset response time.
