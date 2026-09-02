<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Physical qualification checklist

## Supported installation methods

The diagnostic BIOS can currently be used in only two ways:

1. direct replacement of the internal BIOS ROM; or
2. external BIOS replacement through a Tanam ESE board.

A third method, the Hexbus rear-slot diagnostic cartridge, is under development. It is not released, electrically qualified, or available as a v1.0 installation method. No compatibility is claimed for a bare rear-slot connection, an ordinary game cartridge, or an unspecified external adapter.

Record the machine model, serial number, motherboard revision, video standard, selected installation method, ROM-device or ESE details, selected regional image, release version, and programmed-device readback hash with the test result.

## Shared preparation

- Power the machine off and disconnect it before moving any ROM, ESE board, cartridge, cable, or jumper.
- Select the Tutor or original-Pyuuta regional image deliberately. Mk II and Jr compatibility is not claimed.
- Use the v1.0 programmer image from `release/v1.0/` and verify its SHA-256 against `release/v1.0/SHA256SUMS.txt`.
- Blank-check the programmable device, program it, verify it, read it back to a new file, and compare the readback hash with the selected release image.
- Label the programmed device with region, v1.0, hash prefix, and pin-1 orientation.
- Disconnect unrelated cartridges and accessories for the first boot. Keep the selected BIOS-replacement hardware installed.

## Method A: direct internal BIOS replacement

- Photograph the original ROM orientation, notch, pin 1, nearby jumpers, and motherboard silkscreen before removal.
- Read the original ROM at least twice. Require identical reads, record the hash, and archive the image before proceeding.
- Confirm the replacement device or adapter pinout for the exact motherboard revision. Verify VCC, ground, `/CE`, `/OE`, address, data, orientation, and any strapped upper address lines with power disconnected.
- Confirm that the replacement device or adapter cannot place a programming voltage on the motherboard.
- Install the diagnostic ROM in the photographed orientation.

## Method B: Tanam ESE

- Leave the internal BIOS installed.
- Follow the ESE hardware instructions for device type, orientation, bank selection, and BIOS-override operation.
- Verify that the selected ESE bank contains the correct Tutor or original-Pyuuta v1.0 image.
- Do not infer ESE presence from the diagnostic's optional external-memory result. The current ROM does not have a distinct positive ESE identity test.

## Method C: future Hexbus diagnostic cartridge

Do not use an unfinished prototype as a v1.0 installation method. The board must first pass the continuity, direction, decode, contention, and timing qualification maintained in the companion [`tomy-diag-cartridge`](https://github.com/hexbus/tomy-diag-cartridge) repository. A successful display alone will not prove safe bus ownership.

## Current-limited first boot

- Use a current-limited supply or series current measurement and stop on abnormal current, heat, smell, or a collapsed rail.
- Expect a startup tone, automatic tests, four PSG channel/noise samples, then a pass/fail sound. The full music exercise is selected manually from menu item 5.
- In menu item 4, verify smooth sprite motion and size changes, Text and Multicolor pages, then three seconds of red/white/green lines bending smoothly back and forth. Static straight bands, random/noise-like tiles, tearing, or lockup are failures.
- Before the full-array VRAM tests in menu item 3, require a readable warning and `3`, `2`, `1` countdown. Holding `0` during the warning must cancel without starting the full test.
- Photograph the complete System Information summary before pressing keys.

## Automatic-result acceptance

- CPU core: PASS.
- On-chip RAM: PASS.
- `DIAG ROM CHECK: PASS` and `DIAG SUMS>0000/0000`. This checks the installed diagnostic image, not the stock BIOS.
- VDP/VRAM: PASS, or record the first address and lane mask.
- VDP frame: PASS.
- Border green only when cumulative automatic flags are zero; red otherwise.
- With no optional external memory: `EXT: NOT CONNECTED`, no writable-pair claim, and no failure flag. Absence is normal and must not fail the diagnostic.
- With the proven Tanam memory profile: `TANAM 2X8K INDEP` and `MAP >6000+>C000: 2X8K RW`.

Power-cycle and verify that the automatic extension probe restored its original words. Menu item 7 is separate and destructive: it is enabled only after both independent windows are detected and requires a second `7` confirmation before erasing and March-testing all 16 KiB.

If menu item 6 identifies a VRAM lane, use the board-qualified [VRAM chip/lane lookup](VRAM-CHIP-LANE-LOOKUP.md). Verify the required DRAM supply rails only when the documented motherboard revision actually uses 4116 devices; the lookup is not universal across models or revisions.

## Human-observed tests

- Hear four distinct startup samples: PSG channel 0, channel 1, channel 2, and noise.
- Press each main-menu number from `1` through `8`. Confirm that only the selected numeral becomes bold, a short acknowledgement beep sounds, and the selected page opens after a slight delay. Confirm every framed-page title is centered and uses title case rather than all capitals.
- Select menu item 5 and verify 29.897 seconds of moving red/white/green waves with the approved high-energy MegaDemo PSG passage. The eight 224-frame repeats must cross their beat boundary without a hiccup. Confirm the screen credits Rasmus/ASMUSR. Restart it and confirm `0` immediately mutes every channel and returns to the menu.
- Verify readable text, foreground colors, and green/red border behavior. Sprite symbols appear only inside the VDP showcase; an X there is a test pattern, not a system-failure mark.
- Open menu item 2, then test the independent keyboard page for all eight rows. Confirm each press remains in `LAST` after release and `#` advances only once while a key is held. Test both Shift keys; verify Shift+0 displays `EQUALS`, Shift+semicolon displays `PLUS`, a quick 0 tap remains testable, and only an unshifted hold of about one second exits.
- On the independent controller page, connect and exercise one port at a time. Player 1 and Player 2 must change only their own fire/left/right/down/up indicators; activity from both physical ports in one player display is a failure.
- In menu item 3, run visible scrub. Confirm all 64 blocks complete and the GUI is reconstructed after each overwritten block.
- In menu item 3, run one strict full-array March-B pass and then continuous mode. The VRAM data intentionally owns the display during the five whole-array elements; phase border colors remain observable. Require PASS after one pass, then confirm `0` stops continuous mode at a 256-byte boundary and produces a stable `STOPPED` result page.
- With detected Tanam memory, run both the one-pass and continuous all-16-KiB tests only after accepting the destructive warning. Confirm `0` stops continuous mode at a block boundary.
- Run menu item 4 and observe Graphics I, 40-column Text with lowercase, Multicolor, streamed patterns, sprite collision/overflow, 8x8, 16x16, magnified sprites, and the final Graphics-I raster wave. It must leave the raster wave automatically and reach the showcase result page; repeat while holding `0` during a timed phase and confirm it exits cleanly rather than locking.
- Open menu item 8 and verify the Credits and Thanks page names Jon G. (hexbus), Jim F. (Ksarul), Takeo N. (Tanam1972), Rasmus M. (Rasmus), Mike B (Tursi), Alan (Old CS1), the MegaDemo team, and the AtariAge TI-99 Forum.
- Run five cold boots.
- Run for 60 minutes while watching for changing borders, corruption, intermittent sound, or stuck input bits.

## Diagnostic-ROM checksum failure

Record both hexadecimal sums. Equal, repeatable nonzero values suggest the wrong or old file, the wrong selected EPROM bank, or an image that did not receive the build correction. Unequal values or values that vary across cold boots suggest an unstable ROM socket, device, address path, or data path. Read the programmed device back and compare its SHA-256 before blaming the removed or overridden stock BIOS.

## Restoration

- Power off before removing or moving any device or jumper.
- After direct replacement, reinstall the archived original BIOS in its photographed orientation.
- After ESE testing, return the ESE and machine to stock operation according to the ESE instructions.
- Confirm a normal stock boot without the diagnostic BIOS selected.
- Keep known-good original and diagnostic devices in labeled antistatic storage.
