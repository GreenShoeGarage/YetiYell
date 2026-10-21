# YetiYell v1.0.0-rc.6 validation

Date: 2026-10-20. Release status: **candidate; physical acceptance outstanding**. rc.6 is a browser-only cache/update and radio-start confirmation fix. The required and bundled firmware is still rc.4; its source and images are unchanged, and no new firmware build was needed. Boards already running rc.4 do not need reflashing.

## Verified

On 2026-10-14, all three retained rc.4 targets compiled and linked using PlatformIO espressif32 6.10.0, official Arduino ESP32 2.0.17, NimBLE-Arduino 1.4.3, ArduinoJson 6.21.5. No SDK source patches were applied. The Arduino core uses the official 2.0.17 archive; pinned libraries and compiler packages came from PlatformIO. Final builds ran with `PLATFORMIO_SETTING_ENABLE_TELEMETRY=no`. Build commands and equivalent public inputs are in README.

| Target | RAM | Application code | Packaged application image |
|---|---:|---:|---:|
| ESP32 4 MB | 52,324 / 327,680 bytes | 967,925 / 3,145,728 bytes | 974,496 bytes |
| ESP32-C3 4 MB | 43,092 / 327,680 bytes | 911,034 / 3,145,728 bytes | 936,992 bytes |
| ESP32-S3 N8 8 MB | 48,636 / 327,680 bytes | 862,937 / 3,145,728 bytes | 863,296 bytes |

S3 uses DIO 80 MHz and an 8 MB image header; its application partition remains 3 MB. Original ESP32/C3 use DIO 40 MHz and 4 MB headers. C3/S3 bootloader offset is 0; original ESP32 is 0x1000. Hashes and offsets are in each board manifest.

- **62 automated Node tests passed, zero failed.** They cover catalog agreement, payload size limits, parameter boundaries, formula-safe CSV, legacy workspace compatibility, schema 2 round-trip/merge limits, 100-step sessions, pause/cancel/interruption, mocked USB handshakes, command timeouts, real module/DOM integration, hidden-tab cancellation, receiver row formats, ambiguous and missing evidence, comparisons, and firmware integrity/board mismatches. New tests execute the delivered classic bundle in a simulated DOM, verify synchronous port requests and duplicate guards, and check actionable responses for startup failures, unavailable APIs, insecure origins, and serial-policy restrictions.
- Native C++ policy checks run on 2026-10-14 cover RF settings, duration, heartbeat deadlines and unsigned timer rollover.
- On 2026-10-13, a separate native test using the pinned SquachWatch signature functions passed **42 profile checks and 7 boundary checks**. The profile catalog is unchanged in rc.6. It checks constants and pattern expectations, not the full detection engine, actual emitted bytes, RF performance, filtering, or alert behavior.
- JavaScript syntax and release-package consistency checks passed before packaging. The package script verifies ZIP CRC and records deterministic timestamps.

Connection checks cover a silent CP2102-like port, explicit normal-boot reset sequencing, signal-release cleanup, partial boot text, and the delivered app’s timeout-to-recovery UI. Tests use mock serial streams; no physical board was available. Later user screenshots on 2026-10-14 confirm a working USB link and a start rejection: “Radio could not start.”

## Recurring USB timeout regression

The 2026-10-20 screenshot shows the app's generic "Device stopped responding" banner. It does not show a boot log, driver error, or proof of a physical reset. The rc.4 monitor chained `ping` and `status` every 1.2 seconds and disconnected if either failed once. A mock reproduction against the original rc.4 source dropped one status reply: the app disconnected despite multiple successful ping acknowledgements. This confirms an app defect that can produce the reported message; it does not prove the exact electrical/firmware cause of the user's missing reply.

rc.5 tests cover a three-minute virtual-time connection with missing status replies, a separate three-minute run with every eighth ping acknowledgement missing, bounded disconnection after complete silence, recovery from a replaced reader with a partial JSON line, physical-removal simulation, expired queued starts, and stale callbacks after reconnection. Delivered-bundle tests cover continued connection, temporary checking with Start disabled, recovery without flashing, and runtime diagnostics. No test automatically retransmits a start. The retained firmware still enforces the six-second heartbeat deadline.

Real browser timers, macOS USB bridge behavior, power quality, and RF operation on the user's board were not tested. A new USB console log is needed if rc.5 still disconnects.

## Cache and startup follow-up

On 2026-10-20, direct HTTPS requests to `https://mbparks.com/yetiyell/` returned rc.5 HTML and JavaScript plus firmware rc.4. Both `app.js` and `sw.js` carried `Cache-Control: public, max-age=604800`. The current server bundle contained the new two-attempt error and did not contain the user's quoted old "Device stopped responding." message. This is evidence of a stale/mixed-code possibility, not direct inspection of the user's browser cache. HTTP-cache reuse during previous `cache.addAll` installations could also preserve old assets.

rc.6 uses release-specific entry scripts and rejects a mismatched page/runtime pair. The worker installer uses reload requests rather than accepting HTTP-fresh old assets. Recovery-page DOM tests verify only the matching worker registration and app-folder cached responses are removed, unrelated scopes/cached responses and saved workspace data survive, and incomplete uploads are reported. The offline test verifies fresh install requests, retained explicit update activation, and a network-only recovery page.

A separate regression against the actual rc.5 bundle at commit `d705da9f1db6e7a4011950f8559cd0ab4e7d0f6c` simulated a successful Start acknowledgement and matching running status, then dropped the initial status acknowledgement. The run was stopped and its active display disappeared. The same test passes with rc.6. Tests also cover missing Start acknowledgement with matching running state, missing initial-status acknowledgement with matching state, and acknowledgement-only starts without any running confirmation. These are serial/DOM simulations, not RF tests.

## Radio-start regression

The firmware passed `BLE_HCI_ADV_TYPE_ADV_NONCONN_IND` (3) to `NimBLEAdvertising::setAdvertisementType`. In NimBLE-Arduino 1.4.3 this setter stores a GAP connection mode; the underlying validator accepts modes 0–2 and rejects 3 with `BLE_HS_EINVAL`. The firmware now passes `BLE_GAP_CONN_MODE_NON` (0), preserving the intended nonconnectable advertising behavior.

`verify_radio_contract.py` compiles the pinned library’s actual setter and validator into a separate native test, with an idle GAP state and available connection allocation. It confirms that the old value fails, the production value passes, and an invalid high-duty configuration fails. Running the same check against the previous firmware source fails as expected. It does not invoke a Bluetooth controller or prove over-the-air reception. The app also prevents old firmware from starting and preserves an interrupted, unreviewed result when firmware rejects a run.

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
