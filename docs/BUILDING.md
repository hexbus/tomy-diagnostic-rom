<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Building and assembler portability

The ROM implementation is entirely in the three files under `src/`.

- `t_diag.a99` selects the American Tutor keyboard legend.
- `p_diag.a99` selects the original Japanese Pyuuta legend.
- `diag.a99` contains the shared diagnostic implementation and
  all ROM-resident tables.

All three source names fit the TI ten-character filename limit. Suggested
Editor/Assembler object names are `t_diag.obj` and `p_diag.obj`; those also fit
the limit. When moving the files to a TI disk, adjust only the `COPY` operand if
the chosen native tool requires a device-qualified name such as `DSK1.DIAG`.

`build.ps1` is a reproducible PC-side convenience around xdt99. It validates
display strings and titles, assembles a 16 KiB core, applies the image checksum
word, verifies the reset workspace and build marker, and repeats the core four
times for a W27C512 programmer image. `test.ps1` and `tools/run_emulator.js`
are optional regression tools.

None of the PowerShell variables, JSON manifest fields, documentation, or
permission records are consumed by the assembly source. To assemble on a
TI-99-family development system in the future, start from one regional wrapper
and the common source, then translate only xdt99-specific source directives to
the syntax of the chosen native assembler. Preserve the final 16 KiB layout,
reset vector, checksum word at `>3FFC`, and marker `>D1A6`.
