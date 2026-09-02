# Tomy Diagnostic ROM v1.0

Use the image matching the keyboard legend on the machine:

- `pyuuta-diag-w27c512.bin` — original Japanese Pyuuta
- `tutor-diag-w27c512.bin` — American Tomy Tutor

Each 65,536-byte W27C512 programmer image contains four identical copies of
its 16 KiB core. The copies begin at file offsets `0x0000`, `0x4000`,
`0x8000`, and `0xC000`, so either state of A14 and A15 selects the diagnostic.

The image can currently be used only as a direct internal BIOS replacement or
as an external BIOS replacement through a Tanam ESE board. The future Hexbus
rear-slot diagnostic cartridge is under development; it is not released,
electrically qualified, or available as a v1.0 installation method. No bare
rear-slot connection, ordinary game cartridge, or unspecified adapter is
claimed to work.

The matching `*-diag-16k.bin` files are the unreplicated cores. Verify the
selected file against `SHA256SUMS.txt` after downloading and again after
programming/read-back.

This ROM performs destructive RAM and VRAM tests. For direct replacement,
archive the original system ROM and confirm replacement-device pin
compatibility before installation. For ESE use, leave the internal BIOS
installed and follow the ESE hardware instructions.
