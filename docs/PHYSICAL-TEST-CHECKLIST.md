<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Physical qualification checklist

Record machine model, serial, board revision, video standard, ROM part number, adapter revision, programmed-device part/date code, programmer software, and every SHA-256 value with the test result.

## Before removing the internal ROM

- Photograph socket orientation, notch, pin 1, nearby jumpers, and board silkscreen.
- Read the original ROM at least twice; require identical files and archive their hashes.
- With power disconnected, map every socket pin to VCC, ground, address, data, chip-select, and output-enable.
- Confirm that the intended device and adapter never place a programming voltage on the console.
- Verify all required 4116 supply rails before interpreting any VRAM chip result.

## Program and verify

- Select the Tutor or Pyuuta regional image deliberately.
- Prefer the repeated 64 KiB W27C512 image when using that device.
- Blank-check, program, verify, read the device back to a new file, and compare its SHA-256 with `build/SHA256SUMS.txt`.
- Label the device with region, build hash prefix, pin-1 orientation, and `v1.0 - DESTRUCTIVE TEST`.

## Current-limited first boot

- Remove external cartridges and rear expansions for the first test.
- Use a current-limited supply or series current measurement and stop on abnormal current, heat, smell, or a collapsed rail.
- Expect a startup tone, automatic tests, four PSG channel/noise samples, then a pass/fail sound. The full music exercise is selected manually from menu item 5.
- In menu item 4, verify smooth sprite motion and size changes, Text and Multicolor pages, then three seconds of red/white/green lines bending smoothly back and forth. Static straight bands, random/noise-like tiles, tearing, or lockup are failures.
- Before VRAM menu options 2 or 3 begin, verify the warning explains that colors will change, controls pause during a pass, the display is restored afterward, and an error produces a red border plus the failing address. Require a readable `3`, `2`, `1` countdown; holding `0` during it must cancel without starting the full test.
- A machine that cannot initialize video should still make the early audio code. A red-border attempt plus repeating noise indicates an on-chip RAM/early fault.
- Photograph the complete summary before pressing keys.

## Automatic-result acceptance

- CPU core: PASS.
- On-chip RAM: PASS.
- `DIAG ROM CHECK: PASS` and `DIAG SUMS>0000/0000`. This checks the installed diagnostic image, not the removed stock Pyuuta/Tutor BIOS.
- VDP/VRAM: PASS, or record first address and lane mask.
- VDP frame: PASS.
- Border green only when cumulative automatic flags are zero; red otherwise.
- Stock machine: `EXT: NOT CONNECTED`, no writable-pair claim, and no failure flag. Absence is the normal optional-hardware state.
- Proven Tanam profile: `TANAM 2X8K INDEP` and `MAP >6000+>C000: 2X8K RW`.

Power-cycle and verify the automatic extension probe restored its original words. Menu item 7 is separate and destructive: it is enabled only after both independent windows are detected and requires a second `7` confirmation before erasing and March-testing all 16 KiB.

## Human-observed tests

- Hear four distinct samples: PSG channel 0, channel 1, channel 2, noise.
- Press each main-menu number from `1` through `8`. Confirm that only the selected numeral becomes bold, a short acknowledgement beep sounds, and the selected page opens after a slight delay. Confirm every framed page title is centered and uses title case rather than all capitals.
- Select menu item 5 and verify 29.897 seconds of moving red/white/green waves with the approved high-energy MegaDemo PSG passage. The eight 224-frame repeats must cross their beat boundary without a hiccup. Confirm the screen credits Rasmus/ASMUSR. Restart it and confirm `0` immediately mutes every channel and returns to the menu.
- Verify readable text, several foreground colors, and green/red border behavior. Sprite symbols appear only inside the VDP showcase; an X there is a test pattern, not a system-failure mark.
- Open menu 2, then test the independent keyboard page for all eight rows. Confirm each press remains in `LAST` after release and `#` advances only once while a key is held. Test both Shift keys; verify Shift+0 displays `EQUALS`, Shift+semicolon displays `PLUS`, a quick 0 tap remains testable, and only an unshifted hold of about one second exits.
- On the independent controller page, connect and exercise one port at a time. Player 1 and Player 2 must change only their own fire/left/right/down/up indicators; activity from both physical ports in one player display is a failure.
- In menu item 3, run visible scrub. Confirm all 64 blocks complete and the GUI is reconstructed after each overwritten block.
- In menu item 3, run one strict full-array March-B pass and then continuous mode. The VRAM data intentionally owns the display during the five whole-array elements; phase border colors remain observable. Require PASS after one pass, then confirm `0` stops continuous mode at a 256-byte boundary and produces a stable `STOPPED` result page.
- With a detected Tanam cartridge, run both the one-pass and continuous all-16-KiB tests only after accepting the destructive warning. Confirm `0` stops continuous mode at a block boundary.
- Run menu item 4 and observe Graphics I, 40-column Text with lowercase, Multicolor, streamed patterns, sprite collision/overflow, 8x8, 16x16, magnified sprites, and the final Graphics-I raster wave. It must leave the raster wave automatically and reach the showcase result page; repeat while holding `0` during a timed phase and confirm it exits cleanly rather than locking.
- Open menu item 8 and verify the Credits and Thanks page names Jon G. (hexbus), Jim F. (Ksarul), Takeo N. (Tanam1972), Rasmus M. (Rasmus), Mike B (Tursi), the MegaDemo team, and the AtariAge TI-99 Forum.
- Run five cold boots.
- Run for 60 minutes while watching for changing border, corruption, intermittent sound, or stuck input bits.

If the diagnostic ROM check fails, record both hexadecimal sums. Equal, repeatable nonzero values suggest the wrong/old file, wrong selected EPROM quarter, or an image that did not receive the build correction. Unequal values or values that vary across cold boots suggest an unstable ROM/socket/address/data path. Read the programmed device back and compare its SHA-256 before blaming the original Pyuuta BIOS.

## Restoration

- Power off before removing or moving any device or jumper.
- Reinstall the archived original ROM in its photographed orientation.
- Confirm a normal stock boot with no diagnostic hardware connected.
- Keep the known-good original and diagnostic devices in labeled antistatic storage.

## Rear override addendum

Do not connect the rear prototype until all continuity and direction checks in `hardware/REAR-BIOS-OVERRIDE.md` pass. NORMAL must be qualified before DIAG. Measure data-bus contention with a scope/current probe; a successful screen alone is not proof of safe bus ownership.
