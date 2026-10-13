# Changelog

## 1.0.0-rc.1 — 2026-10-13

Implemented in four development batches from v0.1.0. Intermediate roadmap versions were not separate published releases.

### Batch 1 — reliability

- Board-aware flash image validation, exact firmware/catalog matching, UART targets and slow flashing recovery.
- Compatible hello/stop-limit validation and USB write-queue recovery.
- Idle-only offline update flow; complete local runtime assets.

### Batch 2 — repeatable work and evidence

- Editable saved suites, repeat limits, quiet gaps, pause/resume/cancel, 100-step sessions, and explicit continuation.
- Saved bench configurations and workspace schema 2, including v1 migration and bounded merges.
- SquachWatch SD log ingestion, clock alignment, exact-MAC/time correlation, ambiguity handling, explicit reviewed application, provenance exports.
- Session comparison with setting/bench matching and incomplete-evidence states.

### Batch 3 — coverage and hardware

- 42 profiles (33 BLE / 9 Wi-Fi), including seven controls, Apple synthetic patterns, extra UUID/manufacturer/name rules, and two fixed Wi-Fi prefixes.
- ESP32 4 MB, C3 4 MB, and S3 N8 8 MB UART firmware binaries.
- Pinned upstream signature-function oracle and profile catalog agreement checks.

### Batch 4 — candidate verification and handoff

- Integration checks through a mocked USB device, interruption tests, 100-step orchestration test, workspace/evidence validation, multi-target integrity tests.
- Exportable bench acceptance form, profile matrix, board-specific binaries, full sources, hosting instructions, release gate, and repeatable packaging.

Stable v1.0 remains gated on real-browser, USB, RF, and receiver acceptance evidence. No hardware result has been fabricated or inferred from compilation.

## 0.1.0 — 2026-10-13

Initial engineering preview: browser flasher, classic ESP32 firmware, 17 profiles, bounded transmissions, manual observations, local records, exports and offline caching.
