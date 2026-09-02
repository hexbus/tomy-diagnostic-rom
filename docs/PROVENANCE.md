<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# Provenance and acknowledgements

## Independent diagnostic implementation

The Tomy Diagnostic ROM is an independently written TMS9995/TMS9918A
diagnostic. No source code, binary code, text, fonts, graphics, or music from
the following diagnostic projects is included:

- [Apple II Dead Test](https://github.com/misterblack1/appleII_deadtest)
- [TRS-80 Diagnostic ROM](https://github.com/misterblack1/trs80-diagnosticrom)
- [x86 RAM Test](https://github.com/ki3v/xtramtest)
- [DesTestMAX](https://factorofmatt.com/destestmax)

They were consulted only as design inspiration for general diagnostic ideas
such as starting without trusted RAM, destructive March-style memory tests,
retaining useful failure information, and providing visible or audible fault
feedback. Those ideas were independently implemented for the unrelated Tomy
architecture.

Tomy and Texas Instruments firmware is not included. Hardware schematics,
photographs, manuals, and firmware dumps used to understand the target
machines are reference evidence only and are not redistributed here.

## MegaDemo material used with permission

Version 1.0 incorporates two small, attributed elements derived from the TI-99
MegaDemo:

- a 298-byte encoding of the high-energy PSG passage captured across 224
  VBlank intervals; and
- an adaptation of the red/white/green raster-wave effect and its compact
  pattern/sine data.

Jon reports that Rasmus M. (`ASMUSR`) wrote the green-line effect and knowingly
approved its reuse in both the Pyuuta/Tutor and TI-99 diagnostic ROMs. Jon also
reports permission for the high-energy PSG passage in this diagnostic-hardware
context. The ROM credits `Rasmus/ASMUSR` and the `MegaDemo team`.

The complete MegaDemo, its player, other scenes, and its complete executable
banks are not included or relicensed by this repository. The permitted
MegaDemo-derived portions are excluded from the repository's Apache-2.0 grant;
see `LICENSE.md`.
