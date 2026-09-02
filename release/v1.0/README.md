# Tomy Diagnostic ROM v1.0

Use the image matching the keyboard legend on the machine:

- `pyuuta-diag-w27c512.bin` — original Japanese Pyuuta
- `tutor-diag-w27c512.bin` — American Tomy Tutor

Each 65,536-byte W27C512 programmer image contains four identical copies of
its 16 KiB core. The copies begin at file offsets `0x0000`, `0x4000`,
`0x8000`, and `0xC000`, so either state of A14 and A15 selects the diagnostic.

The image may be used as a direct internal BIOS replacement or as an external
BIOS replacement through a compatible device such as Tanam's ESE or a
properly qualified Hexbus rear-slot diagnostic cartridge.

The matching `*-diag-16k.bin` files are the unreplicated cores. Verify the
selected file against `SHA256SUMS.txt` after downloading and again after
programming/read-back.

This ROM performs destructive RAM and VRAM tests. Archive the original system
ROM and confirm replacement-device pin compatibility before installation.
