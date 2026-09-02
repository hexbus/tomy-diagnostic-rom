<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Keyboard and controller inputs

The diagnostic gives the keyboard and rear controllers independent screens even though the controllers occupy two asserted-high rows in the same physical input matrix. The keyboard page scans eight logical rows at `>EC00` through `>EC70`, shows each raw byte, latches the most recent decoded contact as `LAST`, and increments `#` once per distinct press. A brief or bouncing closure therefore remains visible after release.

## Full-size Tutor/Pyuuta keyboard matrix

| Row | bit 0 | bit 1 | bit 2 | bit 3 | bit 4 | bit 5 | bit 6 | bit 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | 1 | 2 | Q | W | A | S | Z | X |
| R1 | 3 | 4 | E | R | D | F | C | V |
| R2 | 5 | 6 | T | Y | G | H | B | N |
| R3 | 7 | 8 | 9 | U | I | J | K | M |
| R4 | 0 | `-` | O | P | L | `;` | `,` | `.` |
| R5 | unused | unused | degree/Yen/backslash contact | underscore contact | `:` | `[` | `/` | `]` |
| R6 | unused | Lock | Shift | MON | Return | unused | Mod | Space |
| R7 | Left | Up | Down | Right | unused | unused | unused | unused |

Both physical Shift keys on the replacement PCB are intentionally wired to the same `SHIFT R6B2` matrix contact. They must still be tested separately: each should increment the press counter and latch the same row/bit.

`0` is both a testable key and the page-exit control. A normal tap is decoded and retained like any other key. Exit requires an unshifted hold for about one second. `Shift+0` is therefore available for testing and displays `EQUALS R4B0` rather than leaving the page.

## Shifted character interpretation

The supplied stock-BIOS character workbook establishes that physical matrix contacts and printed PC legends are not interchangeable. Important chords are:

| Native contact/chord | Diagnostic display | Stock character-table byte |
| --- | --- | --- |
| 0 | `0 R4B0` | `0` |
| Shift+0 | `EQUALS R4B0` | `=` |
| hyphen | `- R4B1` | `-` |
| Shift+hyphen | `BAR/DEG R4B1` | `|` (the regional font/keycap may resemble a small circle) |
| degree/Yen contact | `DEG/YEN R5B2` | `\` (shown as Yen by the Japanese presentation) |
| Shift+degree/Yen | `GRAVE/^ R5B2` | `^` |
| semicolon | `; R4B5` | `;` |
| Shift+semicolon | `PLUS R4B5` | `+` |
| MON | `MON R6B3` | control/function contact; it is not a shifted printable character |

The diagnostic reports the electrical contact and the decoded shifted name. It does not pretend that a modern PC keycap changes the native matrix. In particular, the replacement keyboard's PC-style `=`/`+` key position is the PCB switch named `SW_DEGREE1`, not a standalone PC `=` encoder. The native equals chord remains Shift+0 and the native plus chord remains Shift+semicolon.

## Replacement keyboard PCB evidence

The user-supplied `TomyTutorKeyboard-main.zip` is Matthew Splett's passive 57-switch replacement PCB, licensed under the Solderpad Hardware License 0.51. It contains no microcontroller, programmable encoder, or remapping firmware: every Cherry MX switch directly joins one `KEY_PIN_1..8` line to one `KEY_PIN_9..16` line. The important traced switches are:

| PCB switch | Connector pair | Diagnostic contact |
| --- | --- | --- |
| `SW_ZERO1` | KEY_PIN_5 + KEY_PIN_9 | R4B0 |
| `SW_HYPHEN1` | KEY_PIN_5 + KEY_PIN_10 | R4B1 |
| `SW_DEGREE1` | KEY_PIN_6 + KEY_PIN_11 | R5B2 |
| `SW_UNDERSCORE1` | KEY_PIN_6 + KEY_PIN_12 | R5B3 |
| `SW_SHIFT1`, `SW_SHIFT2` | KEY_PIN_7 + KEY_PIN_11 | R6B2 |
| `SW_MONITOR1` | KEY_PIN_7 + KEY_PIN_12 | R6B3 |

This trace is more authoritative than the replacement keycap legends. The ZIP SHA-256 is `5c866c81b52b59a4533f5e48f7e5346c08ade3467ad9a52723ea1a35a4f78b3c`.

## Rear controllers

The physical-hardware correction is important: the rear ports are direct matrix rows, not a TI-99/4A-style output-selected joystick multiplexer. Player 1 is read with an eight-bit `STCR` at `>EC40`; Player 2 is read at `>EC50`. The current stock-compatible scanner and Jon's physical test supersede the earlier column-6/7 latch hypothesis.

| Returned bit | Function |
| --- | --- |
| bit 2 | SL / diagnostic Fire |
| bit 3 | SR / second contact |
| bit 4 | Down |
| bit 5 | Left |
| bit 6 | Up |
| bit 7 | Right |

The diagnostic displays each complete raw byte and presents SL as `FIRE`, followed by left, right, down, and up. Because these rows are electrically shared with keyboard contacts, a controller action can also resemble a row-4/row-5 key to a naïve full keyboard scan. That sharing is normal hardware behavior; conflating both rows into one displayed player or attempting a nonexistent selector write is not.

## Original Japanese Pyuuta and regional scope

The original Japanese keyboard photo confirms the regional legends, while the workbook supplies the stock character translation. The raw electrical row/bit remains the repair authority on both the original keyboard and the replacement PCB. Pyuuta Jr is different: it has a reduced 12-button interface and is not a claimed target of these two full-keyboard builds.

## Pass procedure

1. With no key pressed, record all eight keyboard baseline values.
2. Press and release every physical key separately. Confirm `LAST`, `RnBn`, and one increment of `#`.
3. Test both Shift switches separately, then the Shift+0 equals and Shift+semicolon plus chords.
4. Tap `0` normally and confirm it remains displayed; hold unshifted `0` for about one second to exit.
5. On the controller page, test each port separately for fire, left, right, down, and up, followed by legal diagonals.
6. Investigate any bit that is permanently high, never changes, requires unusual pressure, or changes with an unrelated contact.

The reported intermittent set `Q`, `E`, `T`, `9`, `O`, the PC-keycap position over the degree/Yen contact, Shift, and Down all occupy bit 2 across rows R0 through R7. That one-contact-per-row pattern makes the common bit-2 path—connector, cable, PCB trace, pull-up/input network, and selector/input logic—the first suspect. Individual worn switches remain possible, but eight coincidentally worn switches are less consistent with the pattern.
