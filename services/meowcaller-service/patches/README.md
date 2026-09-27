# Meowcaller inbound relay fix

Upstream proposal: https://github.com/purpshell/meowcaller/pull/26
Applied commit: 340c8894228735e3c9daad7126835b0f32a2c628 (relay change only).
Base: v0.0.0-20260906234207-c48c3e2a243c.

Phone callers can migrate media after accept. The base version connects to one relay, receiving only the initial comfort-noise packets. This upstream patch binds every offered relay, keeps allocate tokens local to their relay and deduplicates RTP before playout. It does not change session storage or pair another number.

Run `python3 tools/prepare_meowcaller.py` before local vet/test/build, as CI and Docker do. This prepares an ignored dependency copy, applies the checked-in patch and adds a local go.mod replacement. Do not commit that generated replacement. The script fails if the patch no longer applies or the new implementation is missing.

Validation: dependency tests, added sequence-wrap/duplicate/closure regressions, service tests, vet, container build and a real phone call. Upstream author reports live validation, but this deployment must be tested independently; successful compilation alone does not prove audio reception.

Rollback: redeploy the prior image/commit 088b8f47edd9079e97cd0d9524e6b976346a8c67. Keep the persistent WhatsApp session volume.
