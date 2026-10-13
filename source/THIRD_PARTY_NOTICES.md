# Third-party components

Original YetiYell code is MIT licensed. All third-party work retains its upstream license and attribution. No association with or endorsement by these projects is implied.

| Component | Pinned version | Source / license |
|---|---|---|
| esptool-js | 0.7.0 | https://github.com/espressif/esptool-js — Apache-2.0 |
| crypto-js | 4.2.0 | https://github.com/brix/crypto-js — MIT |
| pako | See package-lock.json | https://github.com/nodeca/pako — MIT / Zlib |
| atob-lite | 2.0.0 | https://github.com/hughsk/atob-lite — MIT |
| Arduino ESP32 | 2.0.17 | https://github.com/espressif/arduino-esp32/tree/2.0.17 — LGPL-2.1 and component-specific licenses |
| ESP-IDF SDK bundled with Arduino | As shipped with Arduino 2.0.17 | https://github.com/espressif/esp-idf — Apache-2.0 and component-specific licenses |
| NimBLE-Arduino | 1.4.3 | https://github.com/h2zero/NimBLE-Arduino/tree/1.4.3 — Apache-2.0 |
| ArduinoJson | 6.21.5 | https://github.com/bblanchon/ArduinoJson/tree/v6.21.5 — MIT |
| PlatformIO platform-espressif32 | 6.10.0 | https://github.com/platformio/platform-espressif32/tree/v6.10.0 — Apache-2.0 |

Browser dependency license texts are in `dist/vendor/` (or `server/vendor/` in the release). Firmware dependency license texts are in `firmware/licenses/`. Complete application firmware sources and pinned build instructions accompany the binaries; replace or modify the Arduino core by rebuilding with the documented PlatformIO project. The binaries are not signed or locked against replacement by the owner.

Public detection constants were consulted from SquachWatch-CYD commit `44ddd59e11940cb47ac5e223e383501936d50c60`: https://github.com/skizzophrenic/SquachWatch-CYD. SquachWatch is GPL-3.0 licensed; its source code is not incorporated into YetiYell. Test outcomes name the classifications of that detector and are not claims that the transmitter is an authentic product from those manufacturers.

The optional developer script `scripts/verify_detector.py` fetches `signatures.cpp`, `signatures.h`, and `state.h` from that GPL-3.0 snapshot into a temporary directory to execute a separate test oracle. Upstream source/binaries are not embedded in the distributed browser or firmware. The script retains upstream source notices during the test; obtain the upstream LICENSE from the linked repository when retaining or redistributing that separate code.
