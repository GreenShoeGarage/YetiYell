# Roadmap status after the v1.0 build batches

| Milestone | Software status | Remaining acceptance |
|---|---|---|
| v0.2 reliability | Implemented | Physical flash/recovery and Chrome/Edge USB validation |
| v0.3 verified profiles | Source expectations checked | Capture every emitted profile; confirm receiver response |
| v0.4 sequences | Implemented, orchestration tests passed | Physical repeated-run and quiet-gap timing |
| v0.5 coverage | Expanded to 42 fixtures | RF validation of added fixtures |
| v0.6 evidence and comparisons | Implemented | Review representative real receiver logs and clock alignment |
| v0.7 hardware | Three builds compiled and packaged | Test each target, flash size and USB bridge |
| v0.8 field usability | Implemented | Browser, keyboard, responsive layout and field trials |
| v0.9 candidate | Packaged as 1.0.0-rc.1 | Hardware/browser acceptance and long-session bench run |
| v1.0 stable | Protocol/schema documented; release gate present | Resolve all blockers and record acceptance evidence |

The feasible development work is complete for this candidate. Physical validation is still necessary before declaring the planned stable milestone achieved. Operator records can be entered under Field guide; keep packet captures, receiver exports, board identifiers, firmware versions, and browser/OS versions together.

Later work remains outside this candidate: multiple simultaneous transmitters, power-sweep analysis, calibrated instruments, a full detector behavior harness, native-USB-specific builds, extra radios, and user-authored custom packet profiles.
