# YetiYell v1.0.0-rc.6

A self-contained ESP32 wireless signature test bench for SquachWatch. Flash a board in your browser, connect over USB, emit controlled BLE/Wi-Fi fixtures, run repeatable suites, and review detector observations. Static hosting only; all runtime code and firmware are bundled. No account, database, CDN, or telemetry is required when self-hosted.

**Update recovery and transmission-start fix:** rc.6 updates the browser app while keeping firmware rc.4. Upload every file inside `server/`, disconnect the ESP32, and close other YetiYell tabs. Open `refresh-app.html` in your uploaded YetiYell folder, select the checkbox, click **Refresh app files**, then follow **Open the refreshed YetiYell app**. Confirm the header shows rc.6 before reconnecting. This removes only this folder's YetiYell worker registration and cached responses; it keeps saved runs, notes, settings, and board firmware. **No reflash is needed for a board already running rc.4.** Earlier firmware still needs the bundled rc.4 BLE radio-start fix from Set up.

**Release candidate, not hardware-validated v1.0.** All three firmware builds and automated checks passed. Physical flashing, real-browser USB behavior, RF packet captures, and receiver acceptance have not been verified in this environment. `VALIDATION.md` records the evidence and remaining gates. The app includes an operator acceptance form in Field guide.

## Boards and browser

Use a separate transmitter board, not the board running SquachWatch.

| Build | Chip | Flash | Connection | Build status | Hardware status |
|---|---|---|---|---|---|
| `esp32dev` | Original ESP32 / WROOM-32 DevKit | 4 MB | USB-to-UART | Compiled | Unverified |
| `esp32c3` | ESP32-C3 DevKitM-1 | 4 MB | USB-to-UART | Compiled | Unverified |
| `esp32s3` | ESP32-S3 DevKitC-1 N8, no PSRAM required | 8 MB | USB-to-UART | Compiled | Unverified |

C3/S3 firmware uses UART0, not native USB CDC. Use the USB-to-UART connector. Boards exposing only native USB need an external suitable 3.3 V USB-to-UART adapter and appropriate boot wiring. Screens and extra board peripherals are not driven. Other flash capacities, ESP32-S2/C5/C6, ESP8266, Bluetooth Classic, 5 GHz, and LoRa are outside this release.

Use desktop Chrome or Edge on HTTPS or `http://localhost`. Web Serial must be available, and a data-capable USB cable is required. Chip and flash-size mismatches are rejected before writing. SHA-256 checks verify bundled images; esptool verifies the written image hashes. These checks establish integrity, not publisher authenticity or physical interoperability.

## Host or run locally

Upload everything **inside `server/`** from the ZIP to an HTTPS static directory. Keep the structure. Subdirectory hosting is supported. `source/` contains the development project and is not needed to operate the app.

For local use, serve `server/` with any static server, for example:

```sh
cd server
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080` in Chrome or Edge. Opening the HTML with `file://` is unsupported. Serve `app.js`, `boot.js`, and `sw.js` as JavaScript. The runtime is bundled into a classic script with a release-specific filename, so connecting no longer depends on the host recognizing `.mjs` files. Open the app in its own tab if an embedding host blocks serial access.

If the USB chooser does not appear, select **Connection help** beside Connect ESP32. It checks HTTPS, Web Serial availability, and the browser's reported serial permissions policy, and provides copyable connection details. Use **Open app in browser tab** to leave an embedded viewer. Blocked environments show an explanation instead of silently disabling Connect. A persistent startup banner identifies missing scripts or profiles. The app cannot override browser or organization policies.

To enable the in-app package download on your own host, copy the original release ZIP into `server/downloads/`. A ZIP cannot contain a recursive copy of itself; the folder includes this instruction. All operating features work without that optional copy.

## First signal

1. In Set up, choose the exact board and flash size. Close other serial monitors.
2. Select the firmware-replacement checkbox and choose the board's USB port. Keep power connected throughout flashing.
3. If synchronization fails, hold BOOT while connecting, release after chip detection, and try the 115200-baud recovery option. Press EN/RESET after installation if needed. An interrupted write can be retried from the bootloader.
4. Select Connect ESP32. The handshake checks protocol, stop limits, firmware version, and profile catalog before transmission is enabled. Any leftover run is stopped.
5. Start Tile for 20 seconds and inspect SquachWatch's log. Open Results → Record to enter the observation.

If the chooser opens but the app reports no firmware reply, select the board’s USB-to-UART entry (for example CP2102 or CH340). “Paired” only records browser permission; it does not establish installed firmware. Install through **Choose board & flash** if you have not done so. For an already-flashed board, release BOOT, tap EN/RESET, and reconnect. Connection help also offers **Reset board & reconnect**, which pulses the usual UART reset lines only on that explicit action; it never installs firmware or starts RF. Boards without compatible reset wiring need a manual EN/RESET press. Normal Connect does not pulse reset.

Failed connections retain the phase, USB vendor/product IDs, bytes received, and the last 4,000 characters of serial output in **Connection details**. Bootloader and boot-error messages receive specific guidance. Save the USB console log if recovery fails. This diagnostic output cannot prove the firmware is absent merely because the board is silent.

If USB drops after initially working, open **Connection help** or **USB console → Save log**. rc.5 separates heartbeat checks from status polling: an absent status reply no longer disconnects a board that answers pings. One missed ping triggers a bounded retry; a second consecutive failure closes the session. New starts are blocked while checking the link. Recoverable serial read errors reacquire the reader without resetting the board. A genuine board restart or removal still interrupts the run, and tests never restart automatically. Firmware still stops RF within six seconds of its last received heartbeat.

Connection details now retain the verified firmware version, timed-out command and phase, missed ping/status counts, reader errors, and recent board text. The generic timeout banner alone cannot distinguish USB/driver/power trouble from a firmware fault.

A board-confirmed `started` or running `status` event for the current run now takes precedence over a missing command acknowledgement. The app no longer stops that confirmed run merely because the initial status acknowledgement was lost. An acknowledgement without a matching running event does not establish a transmission, and the app stops and reports that uncertainty. Actual RF reception still needs the separate detector.

The header and runtime are checked for version consistency. Release-specific script filenames prevent a host's long HTTP-cache lifetime from loading an older application bundle. Offline installation fetches assets with `cache: reload`, and the worker update check bypasses its HTTP cache. `refresh-app.html` is deliberately never served from the YetiYell worker cache. USB console exports include app/firmware versions, URL, browser, command/read diagnostics, and the captured serial log.

The app checks the board's transmitter state; it does not have live access to the receiver. A started or completed transmission never creates a passing detection result.

## Repeatable suites

Configure one profile under Transmit, then choose **Add this setup to suite**. In Suites, reorder or remove steps, set repeats and a quiet gap, name the suite, and save it. Smoke test and full-catalog presets are included.

A suite has up to 50 steps, 1–10 repetitions, and at most 100 transmissions per session. Each transmission lasts 5–120 seconds; quiet gaps are 1–120 seconds. The estimate includes run durations and gaps, not USB overhead. A session records a snapshot of its steps, detector version, and individual run outcomes.

Pause finishes the current step and quiet gap before waiting for Resume. Cancel stops the current run. A partial step interrupts the sequence. Hiding the tab cancels it; USB loss interrupts it even while paused. Reloading never resumes transmission. Copy remaining steps from a previous session into a new suite, then explicitly start a new session.

Save bench configurations for detector version, Wi-Fi channel, distance/orientation, and receiver filter notes. Individual radio settings live in each suite step. Keep bench conditions consistent when comparing sessions.

## Receiver logs and comparisons

Results accepts the pinned SquachWatch SD log format: seven comma-separated columns, optionally followed by three GPS columns:

```text
time,type,rssi,mac,channel,vendor,name
2026-10-13T20:00:05Z,TILE,-62,C2:59:59:00:00:01,0,Tile,Lab
```

The header is optional. Time is either UTC ISO text or milliseconds since receiver boot. For uptime logs, enter the receiver boot time in UTC. Clock offset seconds are **added to receiver timestamps**. Invalid rows are reported and skipped; arbitrary JSON or console output is not treated as an SD log.

Candidate matching requires an exact transmitter MAC and a timestamp in the run window with ±2 seconds tolerance. A row overlapping multiple runs is excluded from attribution and marked ambiguous; conflicting types require review. Choose and explicitly apply an observation. Its source filename, line, time, and clock alignment are preserved in the run record. Import alone never changes verdicts. Missing rows are not automatic failures or successful negative controls: manually review the receiver conditions.

Comparisons group identical profile, duration, power, channel, interval, and bench notes across two sessions. They summarize recorded verdicts, including missing counterparts, different sample counts, pending review, regressions, and improvements. Firmware versions and unrecorded environmental differences still need human interpretation. Print/PDF includes the current filtered history and any generated comparison. CSV exports all runs with parameters, provenance, and notes.

## Coverage and RF behavior

`profiles.json` is the authoritative catalog: **42 profiles: 33 BLE, 9 Wi-Fi, 7 negative controls**. `PROFILE-MATRIX.csv` lists each fixture and an empty operator-result field.

Coverage includes Tile UUIDs, Samsung SmartTag, Google/Eddystone, five Raven UUIDs, Flipper UUID/manufacturer rules, Flock names and manufacturer data, Meta/Luxottica/Snap IDs, synthetic Apple Find My and pairing patterns, iBeacon, Wi-Fi SSID rules, and two fixed Wi-Fi address-prefix fixtures. Near matches exercise rejected UUIDs, names, and SSIDs.

The reference is SquachWatch commit `44ddd59e11940cb47ac5e223e383501936d50c60`. The separate developer oracle checks fixtures against that snapshot's signature functions; it does not run the complete detector or validate emitted packets. The upstream detector is not shipped inside the app or firmware.

- Nothing advertises at boot. A USB command selects one fixed profile.
- BLE: nonconnectable legacy advertisements, 100–2,000 ms interval, requested power -12/-6/0/+3 dBm. Each profile has a stable static-random address.
- Wi-Fi: ordinary WPA2 lab AP beacons, channels 1–11, requested power 2/5/8 dBm. APs have no uplink or application server. The BLE interval does not control Wi-Fi beacon rate.
- Wi-Fi addresses are locally administered except the two explicit prefix fixtures. Use an isolated bench and one YetiYell transmitter at a time to avoid address collisions.
- Firmware enforces a 120-second maximum and stops within 6 seconds of the last heartbeat. The browser requests a stop when hidden; the firmware deadline is the backstop.
- Power is a requested driver setting, not a calibrated field-strength measurement.

These are detector-rule fixtures, not full product emulations. Apple fixtures use fixed synthetic bytes, not real identities or keys. AIRTAG is the expected result for the pairing false-positive fixture because the pinned detector intentionally uses a broad pattern. iBeacon requires enabling that detector type. Older detector versions may match the Raven near-match control. Review confidence, ignored devices, snooze and cooldown separately from the detection log.

No arbitrary packet editor, deauthentication traffic, evil-twin scenario, Remote ID flight emission, or flooding is implemented. The deauther-name fixture sends an ordinary AP name only.

## Storage, exports and offline use

Workspace schema 2 stores up to 1,000 runs, 50 suites, 100 sessions, 30 bench configurations, 5,000 receiver rows, and 200 acceptance records in browser local storage. Schema 1 workspaces migrate. Imports merge new IDs and preserve existing records; imported active work becomes interrupted. Exports include suites, sessions, receiver evidence, bench settings, and operator acceptance.

Data remains local to the browser origin. Storage limits or browser eviction can remove it. Export JSON before clearing data or upgrading; CSV is an analysis export, not a full workspace backup. Receiver logs may include location data; exported raw evidence retains supplied columns.

The service worker caches local assets and all board images. Field guide → Prepare offline cache checks completeness. New cached releases wait for an idle, explicit update. Export first, stop active work, and apply the update. **When upgrading from v0.1.0**, close all existing YetiYell tabs and reopen after the new worker is installed; that old version lacks the update button. Retain the server ZIP for dependable offline access. Offline caching does not include release ZIP downloads.

## Development

Pinned inputs: PlatformIO 6.2.0, platform-espressif32 6.10.0, Arduino ESP32 2.0.17, NimBLE-Arduino 1.4.3, ArduinoJson 6.21.5, esptool-js 0.7.0, crypto-js 4.2.0. Node dependencies are locked.

```sh
python3 -m pip install platformio==6.2.0
npm ci
npm run vendor
npm run build:app
python3 scripts/generate_firmware_profiles.py
PLATFORMIO_SETTING_ENABLE_TELEMETRY=no python3 -m platformio run -d firmware -e esp32dev -e esp32c3 -e esp32s3
python3 scripts/release_firmware.py
python3 scripts/offline.py
npm test
g++ -std=c++11 tests/policy_test.cpp -o /tmp/yetiyell-policy-test
/tmp/yetiyell-policy-test
python3 scripts/verify_detector.py
python3 scripts/verify_radio_contract.py
python3 scripts/release_gate.py
python3 scripts/package.py
```

The radio-contract check uses the installed NimBLE-Arduino 1.4.3 setter and parameter validator as a separate native test. It rejects the previous HCI mode and accepts the production GAP mode; it does not test physical RF. The detector oracle fetches three GPL-3.0 upstream files into a temporary directory and runs them as a separate test program. It accepts a local reference directory for offline testing. Nothing is linked into the transmitter or browser app.

Edit `dist/profiles.json`, regenerate the firmware table, rebuild all targets, and refresh firmware manifests together. Profile IDs retain their order because addresses depend on catalog index. The generator updates the catalog hash. After editing browser modules, run `npm run build:app` to refresh the delivered script. `release.json` records the app version and its required `firmwareVersion`; a browser-only fix may retain existing firmware. The release gate rejects inconsistent versions and prevents an unvalidated stable release from packaging. Service-worker assets are generated after all runtime files are ready.

`PROTOCOL.md` defines the stable USB protocol. `WORKSPACE.md` documents schema migration. `CHANGELOG.md`, `ROADMAP.md`, and `VALIDATION.md` record the release work and limits. Original code is MIT licensed; dependencies retain their licenses. YetiYell is not affiliated with SquachWatch, Espressif, or any manufacturer represented by a fixture.
