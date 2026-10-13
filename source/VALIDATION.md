# YetiYell v1.0.0-rc.1 validation

Date: 2026-10-13. Release status: **candidate; physical acceptance outstanding**.

## Verified

All three targets compile and link using PlatformIO espressif32 6.10.0, official Arduino ESP32 2.0.17, NimBLE-Arduino 1.4.3, ArduinoJson 6.21.5. No SDK source patches were applied. Core and libraries used locally materialized pinned upstream archives; compiler packages came from PlatformIO. Build commands and equivalent public inputs are in README.

| Target | RAM | Application code | Packaged application image |
|---|---:|---:|---:|
| ESP32 4 MB | 52,100 / 327,680 bytes | 959,853 / 3,145,728 bytes | 966,432 bytes |
| ESP32-C3 4 MB | 42,868 / 327,680 bytes | 901,978 / 3,145,728 bytes | 927,728 bytes |
| ESP32-S3 N8 8 MB | 48,404 / 327,680 bytes | 855,229 / 3,145,728 bytes | 855,600 bytes |

S3 uses DIO 80 MHz and an 8 MB image header; its application partition remains 3 MB. Original ESP32/C3 use DIO 40 MHz and 4 MB headers. C3/S3 bootloader offset is 0; original ESP32 is 0x1000. Hashes and offsets are in each board manifest.

- **32 automated Node tests passed, zero failed.** They cover catalog agreement, payload size limits, parameter boundaries, formula-safe CSV, legacy workspace compatibility, schema 2 round-trip/merge limits, 100-step sessions, pause/cancel/interruption, mocked USB handshakes, command timeouts, real module/DOM integration, hidden-tab cancellation, receiver row formats, ambiguous and missing evidence, comparisons, and firmware integrity/board mismatches.
- Native C++ policy checks cover RF settings, duration, heartbeat deadlines and unsigned timer rollover.
- A separate native test using the pinned SquachWatch signature functions passed **42 profile checks and 7 boundary checks**. It checks constants and pattern expectations, not the full detection engine, actual emitted bytes, RF performance, filtering, or alert behavior.
- JavaScript syntax and release-package consistency checks passed before packaging. The package script verifies ZIP CRC and records deterministic timestamps.

## Not verified here

- Real Chrome/Edge rendering, accessibility behavior, Web Serial permissions, USB bridge drivers, service-worker lifecycle, or physical flashing/recovery.
- Boot-time silence, BLE/Wi-Fi radio operation, actual transmit power, switching behavior and packet contents on physical boards.
- SquachWatch over-the-air detections, timing, missed detections, false positives, filters and alert behavior.
- Physical 100-step operation, board/USB compatibility, and long-duration resource behavior.

DOM tests and mocked serial tests are not real-browser or hardware tests. Firmware manifests intentionally set `hardwareValidated: false`. The stable release gate remains closed.

## Bench acceptance

Run this procedure separately on each declared board/flash target. Record board markings, USB bridge, OS/browser, YetiYell version/catalog, and detector version. Keep SquachWatch on a separate receiver.

1. Flash at standard baud, reset, reconnect, and verify reported chip, version and catalog. Repeat recovery at 115200. Test a deliberately interrupted installation on a spare board and restore it through BOOT mode.
2. Independently verify no BLE advertisements or Wi-Fi AP at boot before Start.
3. Run every fixture in `PROFILE-MATRIX.csv`. Capture packet bytes with an independent scanner, verify MAC/UUID/name/manufacturer/SSID fields, and compare receiver log classification. Enable IBEACON. Record confidence/filter/snooze/ignore settings and receiver reset/cooldown state.
4. Negative controls need an observed full scan window, not just an empty imported file. Confirm source version differences such as Raven range behavior.
5. Verify automatic deadline, explicit Stop, tab hiding, browser closing, USB unplug, board reset, and heartbeat loss. Independently confirm RF ceases within 6 seconds after the last heartbeat.
6. Run the smoke suite, then 100 transmissions with BLE/Wi-Fi transitions. Check quiet gaps, pause/resume, cancellation during transmission and during a gap, and USB loss while paused. No interrupted session may resume automatically after reload.
7. Export a real receiver log, align UTC or boot uptime, and check candidate matches manually. Test repeated same-profile runs and ambiguous windows. Confirm import never sets a verdict by itself.
8. Round-trip workspace JSON in a fresh origin, compare counts and notes, and verify schema 1 migration. Inspect CSV and Print/PDF output, including active filters and session comparisons.
9. Verify offline completeness, disconnect network access, reload, flash and operate. Test a new-release update while idle and confirm no reload occurs mid-run/flash.
10. Check Chrome and Edge, keyboard navigation, narrow/wide layouts, themes, storage failure messaging, and port recovery on each supported OS claimed by the eventual release.

Use the in-app acceptance form and export the operator record. Mark failures or untestable items honestly. Stable v1.0 requires reviewable passing evidence for supported combinations and resolved blockers; changing a version string does not satisfy that gate.
