<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# VRAM failure mask to physical 4116 lookup

## Scope

This table is tied to the supplied mid-production TP1000 schematic, whose source cites serial ZTST038881. It is **not** yet a universal Tutor/Pyuuta board-location table. Before replacing a chip, compare the silkscreen and trace continuity on the actual board.

The ROM stores a byte comparison in the high byte of a TMS9995 word. Therefore the displayed mask has the form `>xx00`. One set bit means that the expected and actual values disagreed in that software data lane.

| Displayed mask | Byte bit | Schematic VDP/VRAM lane | 4116 position drawn in the supplied TP1000 schematic |
| ---: | ---: | --- | --- |
| `>0100` | D0 | RD0 | D1 |
| `>0200` | D1 | RD1 | D2 |
| `>0400` | D2 | RD2 | C1 |
| `>0800` | D3 | RD3 | C2 |
| `>1000` | D4 | RD4 | B1 |
| `>2000` | D5 | RD5 | B2 |
| `>4000` | D6 | RD6 | A1 |
| `>8000` | D7 | RD7 | A2 |

Example: `VRAM LANE MASK >8000` means the D7/RD7 path disagreed. On the documented TP1000 drawing, A2 is the first DRAM candidate to inspect.

## Interpret the result correctly

A lane result identifies an electrical path, not guilt. Check, in order:

1. DRAM supply rails, especially the 4116's multiple voltages;
2. socket contact and solder joints;
3. continuity from the named 4116 data pin to the VDP lane;
4. shorts to adjacent lanes;
5. VDP data pin behavior;
6. only then substitute the DRAM.

Multiple set bits can indicate several bad DRAMs, a common supply/control fault, an open bus, a VDP problem, or a board revision that does not match this lookup. An address-dependent failure with a clean data mask can instead implicate multiplexed address/control circuitry.

The current ROM records the first failing address and first XOR mask. It does not yet accumulate every intermittent mask across a long soak.
