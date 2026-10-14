# Changelog

## 1.0.0-rc.4 — 2026-10-14

**Firmware update: reflash the transmitter.**

- Corrects BLE startup: `NimBLEAdvertising::setAdvertisementType` expects `BLE_GAP_CONN_MODE_NON` (0), not the HCI PDU type `BLE_HCI_ADV_TYPE_ADV_NONCONN_IND` (3). The pinned NimBLE stack rejects 3 with `BLE_HS_EINVAL`.
- Adds a native regression check using the actual pinned library setter and parameter validator. It rejects the shipped configuration and accepts the corrected configuration.
- Reports radio-start failures by stage, including Wi-Fi driver error codes, and enables error-level stack logging.
- Requires rc.4 firmware before enabling transmission and routes older boards to setup with an explicit reflash message.
- Adds delivered-app checks for old-firmware gating and radio-start rejection without fabricated transmission or detection results.
- All three targets rebuilt successfully, all 47 Node checks passed, and binary hashes/memory maps passed. Physical RF confirmation remains outstanding.


## 1.0.0-rc.3 — 2026-10-14

- Distinguishes an opened serial port with no firmware reply from browser permission failures. The recovery dialog links to firmware setup and USB logs rather than suggesting another browser tab.
- Adds an explicit Reset board & reconnect action with normal-boot DTR/RTS sequencing and no automatic firmware installation or RF transmission.
- Captures handshake attempts, port identity, byte counts and bounded boot output; explains download mode, boot errors and silent boards.
- Clarifies that Connect does not flash firmware and that a paired CP2102 entry represents port permission only.
- All 45 automated checks pass, including delivered-bundle timeout recovery and mocked reset/cleanup cases. Existing rc.1 firmware is unchanged. The reported physical connection failure still needs confirmation on the user’s board.

## 1.0.0-rc.2 — 2026-10-14

- Connection help explains unavailable Web Serial, insecure origins, embedded restrictions, and permission denial; includes direct-tab links and copyable diagnostics.
- Connect remains actionable in unsupported environments and explains why the chooser cannot open. Both connection and flashing request the port directly from the user click and guard duplicate requests.
- Bundled classic JavaScript removes the runtime dependency on `.mjs` MIME handling by static hosts. A small startup script reports failed app loading.
- Six additional checks exercise the delivered bundle, environment failures, synchronous chooser calls, and startup errors. All 38 automated Node checks pass.
- Retains v1.0.0-rc.1 firmware for all three boards. No reflash is required for this browser-app update. Physical USB/browser acceptance remains outstanding.

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
