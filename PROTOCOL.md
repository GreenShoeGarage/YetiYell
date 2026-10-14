# YetiYell USB protocol 1

115200 baud, UTF-8, newline-delimited JSON, maximum command line 767 bytes. Every request has a positive integer `id`. Events and replies are separate: a successful start acknowledgement means the command was accepted; the board emits `started` with its run token and subsequent `status` messages once per second.

```json
{"id":1,"cmd":"hello"}
{"id":2,"cmd":"start","profile":"tile","run":"a-client-generated-unique-id","duration":20,"power":-12,"channel":6,"interval":250}
{"id":3,"cmd":"ping"}
{"id":4,"cmd":"status"}
{"id":5,"cmd":"stop"}
```

`hello` returns `event: hello`, `app: YetiYell`, `protocol: 1`, `chip` (`esp32`, `esp32c3`, or `esp32s3`), `board`, `flashBytes`, firmware `version`, `catalog` hash, `capabilities`, supported profile IDs, `maxDuration: 120`, `heartbeatTimeoutMs: 6000`, and the active state. It is also emitted with ID 0 on boot. Boot text from the ESP ROM may precede JSON; clients should ignore non-JSON lines.

Other accepted commands return `{"event":"ack","id":N,"ok":true}`. Invalid commands return `ok:false` with an error string. `stop` is idempotent. `start` rejects a new command while the transmitter is already active. Unknown profiles, unsupported RF settings, non-integer settings, missing run tokens, and overlong lines are rejected.

`started`, `status`, and `stopped` include `profile`, `run`, `running`, `elapsedMs`, `remainingMs`, `mac`, and `reason`. Stop reasons: `complete`, `user`, or `heartbeat_lost`. The app also records local states `starting`, `running`, `completed`, `stopped`, `interrupted`, and `error`. Local connection loss is not proof of an immediate RF stop; the board timeout is 6 seconds.

The start command establishes the initial heartbeat. While active, send `ping` more often than once per 6 seconds. UI clients should request `stop` before disconnecting. The board does not retain sessions across reset.

This is a trusted local USB interface, not a network API. Do not expose serial ports to an unauthenticated remote service.

Protocol 1 remains newline JSON. The v1.0 app requires the exact firmware version declared by `FIRMWARE_VERSION` (also `release.json` → `firmwareVersion`) and its profile catalog before enabling Start. Browser app rc.4 requires firmware rc.4, which fixes BLE startup. Boards running rc.1 remain connected for identification but cannot start tests until reflashed. App and firmware version numbers may differ for browser-only fixes. Suites are browser orchestration: each step sends the same start/heartbeat/stop commands. Firmware never automatically advances or resumes a sequence. UART0 is used on all three builds; native USB CDC is disabled.

Radio-start rejection replies retain `event: ack`, `ok: false`, and an explanatory `error`. rc.4 identifies Wi-Fi setup stages and ESP-IDF return codes, BLE random-address errors, or BLE advertising-start failures. Error-level stack logs may appear between JSON lines; clients continue to ignore non-JSON lines. A failed start never emits `started`.
