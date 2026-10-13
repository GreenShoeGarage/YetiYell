# Workspace schema 2

The browser uses `yetiyell.workspace.v1` as its stable storage key; the JSON `schema` field is 2. Keeping the key permits automatic migration from v0.1.0. Exports include `appVersion`.

Top-level fields: `schema`, `detectorVersion`, `runs`, `suites`, `sessions`, `benches`, `evidence`, `acceptance`.

- Runs retain the original scalar record fields and add `sessionId`, `board`, `catalog`, `benchNotes`, `startedAt`, `endedAt`, and observation provenance. State describes transmission; verdict describes the reviewer conclusion. They are independent.
- Suites contain `id`, `name`, `steps`, `repeats`, `gap`. A step contains `profile`, `duration`, `power`, `channel`, `interval`.
- Sessions contain a snapshot of expanded steps, `id`, `name`, `date`, `detectorVersion`, `gap`, `cursor`, `state`, `reason`. Cursor counts completed steps. Partial attempts remain run records with the session ID.
- Benches contain `id`, `name`, `detectorVersion`, `channel`, `notes`.
- Evidence contains `id`, `source`, `row`, `time`, `type`, `mac`, `rssi`, `raw`. It is receiver-supplied material. Import does not imply authenticity or validation.
- Acceptance records contain requirement `id`, `result`, `notes`. They are operator records and cannot alter the firmware manifest's hardware validation flag.

Schema 1 migrates by adding empty collections. Both schemas reject invalid shapes and excessive counts. Restoring/importing running or starting runs interrupts them; running/gap/paused/pausing sessions become interrupted. No import path transmits RF. Imports merge IDs and keep existing records rather than overwriting local observations.

CSV includes scalar run fields and escapes spreadsheet formula prefixes. It cannot restore a workspace. JSON is the full backup format. Clearing evidence preserves attached source references on reviewed runs; these references may then point to rows no longer in the workspace.
