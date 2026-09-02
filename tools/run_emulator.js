#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
/* Deterministic smoke test using JS99er's unmodified TMS9900 CPU core. */

const fs = require('fs');
const path = require('path');

const repoDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(repoDir, '..');
const js99erDir = process.env.JS99ER_PATH
  ? path.resolve(process.env.JS99ER_PATH)
  : path.join(workspaceDir, 'js99er-angular');
const harnessDir = process.env.TOMY_DIAG_HARNESS_PATH
  ? path.resolve(process.env.TOMY_DIAG_HARNESS_PATH)
  : path.join(workspaceDir, 'doordoor-tiport', 'tools', 'js99er-harness');

for (const [label, requiredPath] of [['JS99er', js99erDir], ['test harness', harnessDir]]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`${label} not found at ${requiredPath}; set the corresponding environment path`);
  }
}

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'commonjs', moduleResolution: 'node', target: 'es2020',
  esModuleInterop: true, skipLibCheck: true
});
require(path.join(harnessDir, 'node_modules', 'ts-node', 'register', 'transpile-only'));
const logPath = path.join(js99erDir, 'src', 'app', 'classes', 'log.ts');
require.cache[logPath] = {
  id: logPath, filename: logPath, loaded: true,
  exports: {Log: {getLog() { return {debug() {}, info() {}, warn() {}, error() {}}; }}}
};
const {TMS9900} = require(path.join(
  js99erDir, 'src', 'app', 'emulator', 'classes', 'tms9900.ts'));
const {Subject} = require(path.join(harnessDir, 'node_modules', 'rxjs'));

const imagePath = path.resolve(process.argv[2]);
const reportPath = path.resolve(process.argv[3]);
const expectedRegion = process.argv[4];
const tanamPresent = process.argv[5] === 'tanam';
const fault = process.argv[6] || 'none';
const inputMode = process.argv[7] || 'none';
const rom = fs.readFileSync(imagePath);
if (rom.length !== 0x4000) throw new Error(`expected 16384-byte ROM, got ${rom.length}`);
if (!new Set(['tutor', 'pyuuta']).has(expectedRegion)) throw new Error('region must be tutor or pyuuta');
if (!new Set(['none', 'vram-d7-stuck-low']).has(fault)) throw new Error(`unknown fault ${fault}`);
if (!new Set(['none', 'system-results', 'key-shift', 'key-equals', 'key-plus',
  'key-zero-short', 'key-zero-long', 'key-layout-toggle', 'joystick-screen', 'chip-screen',
  'march-warning', 'march-once', 'march-continuous-stop', 'visible-scrub', 'vdp-showcase',
  'psg-music', 'psg-interrupt', 'tanam-march', 'tanam-continuous-stop', 'credits']).has(inputMode)) {
  throw new Error(`unknown input ${inputMode}`);
}

const menuAckByAddress = new Map([
  [0x0102, 1], [0x0142, 2], [0x0182, 3], [0x01c2, 4],
  [0x0202, 5], [0x0242, 6], [0x0282, 7], [0x02c2, 8]
]);

class VDP {
  constructor() {
    this.ram = new Uint8Array(0x4000);
    this.registers = new Uint8Array(8);
    this.address = 0;
    this.latch = false;
    this.prefetch = 0;
    this.dataWrites = 0;
    this.dataReads = 0;
    this.statusReads = 0;
    this.registerLog = [];
    this.sawVramWarning = false;
    this.vramWarningSnapshot = null;
    this.visibleScrubSnapshot = null;
    this.waveGraphicsISnapshot = null;
    this.menuAcknowledgements = [];
  }
  writeControl(value) {
    value &= 0xff;
    if (!this.latch) {
      this.address = (this.address & 0x3f00) | value;
    } else {
      const command = value >>> 6;
      if (command === 0) {
        this.address = ((value & 0x3f) << 8) | (this.address & 0xff);
        this.prefetch = this.ram[this.address];
        this.address = (this.address + 1) & 0x3fff;
      } else if (command === 1) {
        this.address = ((value & 0x3f) << 8) | (this.address & 0xff);
      } else {
        this.registers[value & 7] = this.address & 0xff;
        this.registerLog.push([value & 7, this.address & 0xff]);
        if (!this.waveGraphicsISnapshot && this.registers[0] === 0x00 &&
            this.registers[1] === 0xe2 && this.registers[3] === 0xc0 &&
            this.registers[4] === 0x04 && this.registers[5] === 0x70) {
          this.waveGraphicsISnapshot = Uint8Array.from(this.ram);
        }
      }
    }
    this.latch = !this.latch;
  }
  writeData(value) {
    if (fault === 'vram-d7-stuck-low') value &= 0x7f;
    const writtenAddress = this.address;
    this.ram[writtenAddress] = value & 0xff;
    const menuAck = menuAckByAddress.get(writtenAddress);
    if (menuAck && value === 0x15 + menuAck) this.menuAcknowledgements.push(menuAck);
    this.address = (this.address + 1) & 0x3fff;
    this.dataWrites++;
    // The safety page is intentionally transient: remember that all three
    // essential warnings appeared before the countdown starts the March test.
    if (writtenAddress < 0x300 && !this.sawVramWarning) {
      const text = Buffer.from(this.ram.slice(0, 0x300)).toString('latin1');
      this.sawVramWarning = text.includes('Full VRAM Test Warning') &&
        text.includes('SCREEN COLORS WILL CHANGE') &&
        text.includes('RED BORDER = MEMORY ERROR');
    }
    if (writtenAddress < 0x300 && (!this.vramWarningSnapshot || !this.visibleScrubSnapshot)) {
      const page = this.ram.slice(0, 0x300);
      const text = Buffer.from(page).toString('latin1');
      if (!this.vramWarningSnapshot && text.includes('Full VRAM Test Warning') &&
          text.includes('BAD ADDRESS + BITS ARE SAVED') &&
          text.includes('HOLD 0 NOW TO CANCEL') && text.includes('STARTING IN ')) {
        this.vramWarningSnapshot = Uint8Array.from(page);
      }
      if (!this.visibleScrubSnapshot && text.includes('Screen-Preserving Test') &&
          text.includes('Testing one 256-byte block') && text.includes('Current address>') &&
          text.includes('Blocks complete>') && text.includes('0 stops after a safe block')) {
        this.visibleScrubSnapshot = Uint8Array.from(page);
      }
    }
  }
  readData() {
    const value = this.prefetch;
    this.prefetch = this.ram[this.address];
    this.address = (this.address + 1) & 0x3fff;
    this.dataReads++;
    return value;
  }
  readStatus() {
    this.latch = false;
    this.statusReads++;
    if (inputMode === 'vdp-showcase') return 0xe0;
    // The bank-18 raster adaptation moves two overlapping transparent
    // sprites down the frame and uses their collision flag as a scanline
    // reference. Bank 18 is a Graphics-I raster trick (R0=0), not Graphics II.
    if (this.registers[0] === 0x00 && this.registers[5] === 0x70) return 0xa0;
    return 0x80;
  }
  peekStatus() {
    if (inputMode === 'vdp-showcase') return 0xe0;
    return this.registers[0] === 0x00 && this.registers[5] === 0x70 ? 0xa0 : 0x80;
  }
}

class CRU {
  constructor(mode) {
    this.mode = mode;
    this.reads = new Set();
    this.scan = 0;
    this.zeroPolls = 0;
    this.selectedColumn = 0;
    this.selectedColumnsSeen = new Set();
  }
  reset() {}
  readBit(address) {
    address &= 0xffff;
    this.reads.add(address);
    if (address === 0x0600) this.scan++;
    if (address === 0x0620) this.zeroPolls++;
    if (this.mode === 'system-results' && this.scan === 2 && address === 0x0600) return true;
    if (this.mode === 'key-shift' || this.mode === 'key-equals' ||
        this.mode === 'key-plus' || this.mode === 'key-zero-short' ||
        this.mode === 'key-zero-long' || this.mode === 'key-layout-toggle') {
      if (this.scan === 2 && address === 0x0601) return true; // menu 2
      if (this.scan === 4 && address === 0x0600) return true; // input lab: keyboard
      if (this.mode === 'key-shift' && this.scan >= 6 && address === 0x0632) return true;
      if (this.mode === 'key-equals' && this.scan >= 6 && this.scan < 16 &&
          (address === 0x0620 || address === 0x0632)) return true; // Shift+0
      if (this.mode === 'key-plus' && this.scan >= 6 && this.scan < 16 &&
          (address === 0x0625 || address === 0x0632)) return true; // Shift+semicolon
      if (this.mode === 'key-zero-short' && this.scan >= 6 && this.scan < 20 &&
          address === 0x0620) return true;
      if (this.mode === 'key-zero-long' && this.scan >= 6 && this.scan < 70 &&
          address === 0x0620) return true;
      if (this.mode === 'key-layout-toggle' && this.scan >= 6 && this.scan < 70 &&
          address === 0x0636) return true; // held MOD, R6B6
      if (this.mode === 'key-layout-toggle' && this.scan >= 75 && this.scan < 86 &&
          address === 0x062a) return true; // PC =/+ cap, R5B2
    }
    if (this.mode === 'joystick-screen') {
      if (this.scan === 2 && address === 0x0601) return true;
      if (this.scan === 4 && address === 0x0601) return true;
      // Physical Tutor/Pyuuta controller rows: P1 >EC40, P2 >EC50.
      // P1 holds fire+left (>24); P2 holds down+right (>90).
      if (this.scan >= 6 && (address === 0x0622 || address === 0x0625)) return true;
      if (this.scan >= 6 && (address === 0x062c || address === 0x062f)) return true;
    }
    if (this.mode === 'chip-screen' && this.scan === 2 && address === 0x0611) return true;
    if ((this.mode === 'march-warning' || this.mode === 'march-once' || this.mode === 'march-continuous-stop' || this.mode === 'visible-scrub') &&
        this.scan === 2 && address === 0x0608) return true;   // menu 3
    if (this.mode === 'march-warning' && this.scan === 4 && address === 0x0601) return true; // lab 2, no confirm
    if (this.mode === 'march-once' && this.scan === 4 && address === 0x0601) return true; // lab 2
    if (this.mode === 'march-continuous-stop' && this.scan === 4 && address === 0x0608) return true; // lab 3
    if (this.mode === 'march-once' && this.scan === 6 && address === 0x0601) return true; // confirm 2
    if (this.mode === 'march-continuous-stop' && this.scan === 6 && address === 0x0608) return true; // confirm 3
    if (this.mode === 'visible-scrub' && this.scan === 4 && address === 0x0600) return true; // lab 1
    if (this.mode === 'vdp-showcase' && this.scan === 2 && address === 0x0609) return true; // menu 4
    if ((this.mode === 'psg-music' || this.mode === 'psg-interrupt') &&
        this.scan === 2 && address === 0x0610) return true; // menu 5
    if ((this.mode === 'tanam-march' || this.mode === 'tanam-continuous-stop') &&
        this.scan === 2 && address === 0x0618) return true; // menu 7
    if (this.mode === 'credits' && this.scan === 2 && address === 0x0619) return true; // menu 8
    if (this.mode === 'tanam-march' && this.scan === 4 && address === 0x0600) return true; // one pass
    if (this.mode === 'tanam-continuous-stop' && this.scan === 4 && address === 0x0601) return true;
    if (address === 0x0620 && this.mode === 'psg-interrupt' &&
        (this.zeroPolls === 12 || this.zeroPolls === 13)) return true;
    if (address === 0x0620 && this.mode === 'march-continuous-stop' &&
        (this.zeroPolls === 190 || this.zeroPolls === 191)) return true;
    if (address === 0x0620 && this.mode === 'tanam-continuous-stop' &&
        (this.zeroPolls === 10 || this.zeroPolls === 11)) return true;
    return false;
  }
  writeBit(address, value) {
    address &= 0xffff;
    if (address < 0x12 || address > 0x14) return;
    const bit = address - 0x12;
    if (value) this.selectedColumn |= 1 << bit;
    else this.selectedColumn &= ~(1 << bit);
    if (bit === 2) this.selectedColumnsSeen.add(this.selectedColumn);
  }
}

class Memory {
  constructor() {
    this.ram = new Uint8Array(0x10000);
    this.ram.fill(0xa5, 0xf000, 0xf0fc);
    this.lowTanam = new Uint8Array(0x2000);
    this.highTanam = new Uint8Array(0x2000);
    this.lowTanam.fill(0x36);
    this.highTanam.fill(0xc9);
    this.vdp = new VDP();
    this.cru = new CRU(inputMode);
    this.soundWrites = [];
    this.unknownReads = new Set();
    this.unknownWrites = [];
    this.pendingIoRead = null;
  }
  commitPendingIoRead() {
    if (this.pendingIoRead === null) return;
    const address = this.pendingIoRead;
    this.pendingIoRead = null;
    if (address === 0xe000) this.vdp.readData();
    else if (address === 0xe002) this.vdp.readStatus();
  }
  readWord(rawAddress) {
    this.commitPendingIoRead();
    const address = rawAddress & 0xfffe;
    if (address < 0x8000) {
      if (tanamPresent && address >= 0x6000) {
        const i = address - 0x6000;
        return (this.lowTanam[i] << 8) | this.lowTanam[i + 1];
      }
      const i = address & 0x3fff;
      return (rom[i] << 8) | rom[i + 1];
    }
    if (address >= 0xc000 && address < 0xe000) {
      if (!tanamPresent) return 0xffff;
      const i = address - 0xc000;
      return (this.highTanam[i] << 8) | this.highTanam[i + 1];
    }
    if (address === 0xe000) {
      this.pendingIoRead = address;
      return this.vdp.prefetch << 8;
    }
    if (address === 0xe002) {
      this.pendingIoRead = address;
      return this.vdp.peekStatus() << 8;
    }
    if (address === 0xe200) {
      this.pendingIoRead = address;
      return 0;
    }
    if (address >= 0xf000 && address <= 0xf0fa) {
      return (this.ram[address] << 8) | this.ram[address + 1];
    }
    this.unknownReads.add(address);
    return 0xffff;
  }
  writeWord(rawAddress, value) {
    const address = rawAddress & 0xfffe;
    value &= 0xffff;
    if (this.pendingIoRead === address) this.pendingIoRead = null;
    else this.commitPendingIoRead();
    if (address === 0xe000) { this.vdp.writeData(value >>> 8); return; }
    if (address === 0xe002) { this.vdp.writeControl(value >>> 8); return; }
    if (address === 0xe200) { this.soundWrites.push(value >>> 8); return; }
    if (tanamPresent && address >= 0x6000 && address < 0x8000) {
      const i = address - 0x6000;
      this.lowTanam[i] = value >>> 8; this.lowTanam[i + 1] = value & 0xff; return;
    }
    if (tanamPresent && address >= 0xc000 && address < 0xe000) {
      const i = address - 0xc000;
      this.highTanam[i] = value >>> 8; this.highTanam[i + 1] = value & 0xff; return;
    }
    if (address < 0x8000 || (!tanamPresent && address >= 0xc000 && address < 0xe000)) return;
    if (address >= 0xf000 && address <= 0xf0fa) {
      this.ram[address] = value >>> 8; this.ram[address + 1] = value & 0xff; return;
    }
    this.unknownWrites.push(address);
  }
  getWord(address) { return this.readWord(address); }
  setBreakpoints() {}
}

function wordAt(bytes, address) { return (bytes[address] << 8) | bytes[address + 1]; }
const frameText = new Map([
  [0x10, '┌'], [0x11, '┐'], [0x12, '└'],
  [0x13, '┘'], [0x14, '─'], [0x15, '│']
]);
function screenTextFromRam(ram) {
  return Array.from({length: 24}, (_, row) =>
    Array.from(ram.slice(row * 32, row * 32 + 32), value =>
      frameText.get(value) || String.fromCharCode(value)).join('')).join('\n');
}
function screenText(vdp) { return screenTextFromRam(vdp.ram); }

function frameIsIntact(ram) {
  if (!ram || ram.length < 0x300) return false;
  if (ram[0] !== 0x10 || ram[31] !== 0x11 ||
      ram[23 * 32] !== 0x12 || ram[23 * 32 + 31] !== 0x13) return false;
  for (let column = 1; column <= 30; column++) {
    if (ram[23 * 32 + column] !== 0x14) return false;
  }
  for (let row = 1; row <= 22; row++) {
    if (ram[row * 32] !== 0x15 || ram[row * 32 + 31] !== 0x15) return false;
  }
  return true;
}

function topTitleInfo(ram) {
  if (!ram || ram.length < 32) return null;
  const occupied = [];
  for (let column = 1; column <= 30; column++) {
    if (ram[column] !== 0x14) occupied.push(column);
  }
  if (!occupied.length) return null;
  const start = occupied[0];
  const end = occupied[occupied.length - 1];
  for (let column = start; column <= end; column++) {
    if (ram[column] === 0x14) return null;
  }
  const length = end - start + 1;
  return {
    start, end, length,
    centered: start === Math.floor((32 - length) / 2),
    text: Buffer.from(ram.slice(start, end + 1)).toString('latin1')
  };
}

function containsSequence(values, sequence) {
  for (let i = 0; i <= values.length - sequence.length; i++) {
    if (sequence.every((value, offset) => values[i + offset] === value)) return true;
  }
  return false;
}

const memory = new Memory();
const cycleSubject = new Subject();
let cpu;
const consoleMock = {
  getMemory: () => memory,
  getCRU: () => memory.cru,
  getCPU: () => cpu,
  getKeyboard: () => ({isKeyDown: () => false}),
  getTape: () => ({read: () => 0, setMotorOn() {}, write() {}}),
  cyclesPassed: () => cycleSubject
};
cpu = new TMS9900(consoleMock);
cpu.reset();
const longMemoryTest = inputMode === 'march-once' || inputMode === 'march-continuous-stop' ||
  inputMode === 'visible-scrub' || inputMode === 'tanam-continuous-stop';
const animatedTest = inputMode === 'vdp-showcase' || inputMode === 'psg-music';
cpu.run(longMemoryTest ? 650000000 : animatedTest ? 80000000 : 30000000, true);
memory.commitPendingIoRead();

const screen = screenText(memory.vdp);
const errors = [];
const expectedLabel = expectedRegion === 'tutor' ? 'US TUTOR' : 'JP PYUUTA';
const resultFlags = wordAt(memory.ram, 0xf000);
const titleInfo = topTitleInfo(memory.vdp.ram);
if (fault === 'none' && resultFlags !== 0) errors.push('automatic result flags are nonzero');
if (fault === 'vram-d7-stuck-low' && (resultFlags & 0x0008) === 0) errors.push('VRAM fault was not flagged');
if (fault === 'vram-d7-stuck-low' && wordAt(memory.ram, 0xf00a) !== 0x8000) {
  errors.push('VRAM fault did not identify D7 mask >8000');
}
if (!titleInfo || !titleInfo.centered) errors.push('top-rail title is not centered');
if (titleInfo && /[A-Za-z]/.test(titleInfo.text) && titleInfo.text === titleInfo.text.toUpperCase()) {
  errors.push(`top-rail title is still all caps: ${titleInfo.text}`);
}

const menuSelectionByMode = new Map([
  ['system-results', 1],
  ['key-shift', 2], ['key-equals', 2], ['key-plus', 2],
  ['key-zero-short', 2], ['key-zero-long', 2], ['key-layout-toggle', 2],
  ['joystick-screen', 2],
  ['march-warning', 3], ['march-once', 3], ['march-continuous-stop', 3], ['visible-scrub', 3],
  ['vdp-showcase', 4],
  ['psg-music', 5], ['psg-interrupt', 5],
  ['chip-screen', 6],
  ['tanam-march', 7], ['tanam-continuous-stop', 7],
  ['credits', 8]
]);
const expectedMenuSelection = menuSelectionByMode.get(inputMode);
if (expectedMenuSelection && !memory.vdp.menuAcknowledgements.includes(expectedMenuSelection)) {
  errors.push(`menu ${expectedMenuSelection} did not display its private bold numeral`);
}
if (expectedMenuSelection && !containsSequence(memory.soundWrites, [0x88, 0x08, 0x92])) {
  errors.push(`menu ${expectedMenuSelection} did not play the acknowledgement beep`);
}
if (wordAt(memory.ram, 0xf00e) !== 1) errors.push('VDP frame status was not observed');
if (wordAt(memory.ram, 0xf00c) !== (tanamPresent ? 1 : 0)) errors.push('Tanam discovery result differs');
if (inputMode === 'none' || (inputMode.startsWith('key-') && inputMode !== 'key-zero-long')) {
  if (!screen.includes('Hexbus Tutor/Pyuuta') && !screen.includes('HEXBUS') &&
      !screen.includes('Keyboard Contact Test')) errors.push('diagnostic title missing from VRAM');
  if (!screen.includes(expectedLabel)) errors.push(`regional label ${expectedLabel} missing`);
  if (inputMode === 'none' && !screen.includes(tanamPresent ? 'TANAM 2X8K INDEP' : 'NOT CONNECTED')) {
    errors.push('extension label missing');
  }
}
if (memory.vdp.registers[1] !== 0xc0) errors.push('VDP display register is not >C0');
if (fault === 'none' && inputMode !== 'march-warning') {
  if (!frameIsIntact(memory.vdp.ram)) errors.push('outer page frame was overwritten by screen content');
  const expectedFrameGlyphs = [0x00, 0x00, 0x00, 0x1f, 0x1f, 0x18, 0x18, 0x18,
    0x00, 0x00, 0x00, 0xf8, 0xf8, 0x18, 0x18, 0x18];
  if (!expectedFrameGlyphs.every((value, index) => memory.vdp.ram[0x0880 + index] === value)) {
    errors.push('private square-border glyph patterns were not loaded');
  }
}
if ((inputMode === 'none' || inputMode.startsWith('key-')) &&
    !Array.from(memory.vdp.ram.slice(0x0384, 0x0390)).every(value => value === 0x4f)) {
  errors.push('dark-blue-on-white ASCII color theme was not loaded');
}
if (inputMode === 'none') {
  if (!screen.includes('RELEASE v1.0 - USE WITH CARE')) errors.push('release warning missing');
  const upperA = Buffer.from(memory.vdp.ram.slice(0x0a08, 0x0a10));
  const lowerA = Buffer.from(memory.vdp.ram.slice(0x0b08, 0x0b10));
  if (lowerA.equals(Buffer.alloc(8)) || lowerA.equals(upperA)) {
    errors.push('true lowercase glyph patterns were not loaded');
  }
}
if (fault === 'none' && (memory.vdp.dataWrites < 0x10000 || memory.vdp.dataReads < 0x10000)) {
  errors.push('VRAM sweeps were incomplete');
}
if (fault === 'vram-d7-stuck-low' && memory.vdp.registers[7] !== 0x46) errors.push('failure border is not red');
if (memory.soundWrites.length < 40) errors.push('PSG channel/noise walk was incomplete');
if (memory.cru.reads.size < 64) errors.push('keyboard/controller matrix scan was incomplete');
if (inputMode === 'key-shift') {
  if (wordAt(memory.ram, 0xf014) !== 0x0033) errors.push('Shift did not decode as row 6 bit 2');
  if (wordAt(memory.ram, 0xf016) !== 1) errors.push('held Shift was counted more than once');
  if (!screen.includes('SHIFT   R6B2')) errors.push('latched Shift label is missing');
}
if (inputMode === 'key-equals') {
  if (wordAt(memory.ram, 0xf016) !== 1) errors.push('Shift+0 chord was counted more than once');
  if (!screen.includes('EQUALS  R4B0')) errors.push('Shift+0 was not decoded as EQUALS');
}
if (inputMode === 'key-plus') {
  if (wordAt(memory.ram, 0xf016) !== 1) errors.push('Shift+semicolon chord was counted more than once');
  if (!screen.includes('PLUS    R4B5')) errors.push('Shift+semicolon was not decoded as PLUS');
}
if (inputMode === 'key-zero-short') {
  if (!screen.includes('Keyboard Contact Test')) errors.push('short 0 press incorrectly left the keyboard page');
  if (!screen.includes('0       R4B0')) errors.push('short 0 press was not shown as a testable key');
}
if (inputMode === 'key-zero-long' && !screen.includes('Test Keyboard / Joysticks')) {
  errors.push('long 0 hold did not return to the input menu');
}
if (inputMode === 'key-layout-toggle') {
  if (!screen.includes('VIEW: PC KEYCAPS')) errors.push('held MOD did not select PC keycap view');
  if (!screen.includes('EQUALS  R5B2')) errors.push('PC =/+ keycap was not decoded at R5B2');
}
if (inputMode === 'system-results' && (!screen.includes('System Information') ||
    !screen.includes('ON-CHIP RAM:') || !screen.includes('DIAG ROM') ||
    !screen.includes('0  Main menu'))) {
  errors.push('system-results page or menu instruction is missing');
}
if (inputMode === 'system-results' &&
    !screen.includes('DIAG SUMS>       0000/0000   │')) {
  errors.push('diagnostic sums are not right-aligned with PASS');
}
if (inputMode === 'system-results' &&
    !screen.includes('MAP >0000->3FFF:  DIAG ROM   │')) {
  errors.push('diagnostic ROM map result is not right-aligned with PASS');
}
if (inputMode === 'system-results' && tanamPresent &&
    (!screen.includes('MAP >6000+>C000:   2X8K RW   │') ||
     !screen.includes('EXT:      TANAM 2X8K INDEP   │'))) {
  errors.push('Tanam results are not right-aligned with PASS');
}
if (inputMode === 'system-results' && !tanamPresent &&
    (!screen.includes('MAP >6000+>C000:     NO RW   │') ||
     !screen.includes('EXT:         NOT CONNECTED   │'))) {
  errors.push('not-connected results are not right-aligned with PASS');
}
if (inputMode === 'joystick-screen') {
  if (!screen.includes('Controller / Joystick Test') || !screen.includes('FIRE LT RT DN UP')) {
    errors.push('independent joystick screen is missing');
  }
  if (!memory.cru.reads.has(0x0620) || !memory.cru.reads.has(0x0628)) {
    errors.push('controller rows >EC40 and >EC50 were not both read');
  }
  if (!screen.includes('0024') || !screen.includes('0090')) {
    errors.push('independent controller patterns were not displayed');
  }
}
if (inputMode === 'chip-screen' && (!screen.includes('TP1000 MID-REVISION MAP') ||
    !screen.includes('IC=BOARD ID') || !screen.includes('*IC:A2 D7') ||
    !screen.includes('┌────────────┐  ┌────────────┐'))) {
  errors.push('VRAM chip drawing or failing-lane marker is missing');
}
if (inputMode === 'march-warning' && !memory.vdp.sawVramWarning) {
  errors.push('full VRAM warning page is incomplete');
}
if (inputMode === 'march-warning' && !frameIsIntact(memory.vdp.vramWarningSnapshot)) {
  errors.push('full VRAM warning text overwrote its outer frame');
}
if (inputMode === 'march-once' && wordAt(memory.ram, 0xf01c) < 1) {
  errors.push('sustained March mode did not complete a pass');
}
if (inputMode === 'march-once' && !screen.includes('Full VRAM Test Result')) {
  errors.push('deep March result page is missing');
}
if (inputMode === 'visible-scrub' && wordAt(memory.ram, 0xf072) !== 64) {
  errors.push('visible scrub did not test all 64 VRAM blocks');
}
if (inputMode === 'visible-scrub' && !screen.includes('Screen-Preserving Result')) {
  errors.push('visible scrub result page is missing');
}
if (inputMode === 'visible-scrub' && !frameIsIntact(memory.vdp.visibleScrubSnapshot)) {
  errors.push('screen-preserving progress text overwrote its outer frame');
}
if (inputMode === 'vdp-showcase') {
  const writes = memory.vdp.registerLog.map(([reg, value]) => `${reg}:${value}`);
  const waveR2 = new Set(memory.vdp.registerLog.filter(([reg]) => reg === 2).map(([, value]) => value));
  const waveR3 = new Set(memory.vdp.registerLog.filter(([reg, value]) => reg === 3 && value >= 0xc0 && value <= 0xc7)
    .map(([, value]) => value));
  if (!writes.includes('1:208')) errors.push('VDP text mode was not exercised');
  if (!writes.includes('1:200')) errors.push('VDP multicolor mode was not exercised');
  if (!memory.vdp.waveGraphicsISnapshot) errors.push('bank-18 Graphics-I raster mode was not initialized');
  if (waveR2.size < 8 || waveR3.size < 8) errors.push('Graphics-I raster wave did not exercise all eight phases');
  if (memory.vdp.dataWrites < 80000) errors.push('Graphics-I raster-wave setup did not exercise enough VRAM');
  if (memory.vdp.waveGraphicsISnapshot) {
    const wave = memory.vdp.waveGraphicsISnapshot;
    const phases = [
      [0x6f,0x86,0x98,0xe9,0xce,0x2c,0x32,0xf3],
      [0xf3,0x6f,0x86,0x98,0xe9,0xce,0x2c,0x32],
      [0x32,0xf3,0x6f,0x86,0x98,0xe9,0xce,0x2c],
      [0x2c,0x32,0xf3,0x6f,0x86,0x98,0xe9,0xce],
      [0xce,0x2c,0x32,0xf3,0x6f,0x86,0x98,0xe9],
      [0xe9,0xce,0x2c,0x32,0xf3,0x6f,0x86,0x98],
      [0x98,0xe9,0xce,0x2c,0x32,0xf3,0x6f,0x86],
      [0x86,0x98,0xe9,0xce,0x2c,0x32,0xf3,0x6f]
    ];
    for (let page = 0; page < 8; page++) {
      for (let repeat = 0; repeat < 4; repeat++) {
        for (let i = 0; i < 8; i++) {
          if (wave[0x3000 + page * 0x40 + repeat * 8 + i] !== phases[page][i]) {
            errors.push(`raster color-table phase ${page} is malformed`);
            page = 8; repeat = 4; break;
          }
        }
      }
    }
  }
  if (memory.vdp.statusReads < 780) errors.push('VDP showcase did not complete its animated frame sequence');
  if (!screen.includes('TMS9918A Pattern Results') || !screen.includes('Sprite overlap:') ||
      !screen.includes('Five-sprite limit:') || !screen.includes('Stable pictures = PASS')) {
    errors.push('plain-language TMS9918A result page is incomplete');
  }
}
if (inputMode === 'psg-music') {
  const waveWrites = memory.vdp.registerLog.filter(([reg]) => reg === 2 || reg === 3).length;
  if (memory.soundWrites.length < 1200) errors.push('30-second PSG sequence did not exercise enough notes');
  if (memory.vdp.statusReads < 1800) errors.push('PSG sequence was not timed for at least 30 seconds');
  if (waveWrites < 50000) errors.push('PSG sequence did not run with the raster-wave animation');
}
if (inputMode === 'psg-interrupt') {
  if (wordAt(memory.ram, 0xf076) !== 1) errors.push('PSG music did not latch the 0-key interruption');
  const tail = memory.soundWrites.slice(-4).join(',');
  if (tail !== '159,191,223,255') errors.push('PSG was not muted immediately after interruption');
  if (memory.soundWrites.length >= 1000) errors.push('interrupted PSG sequence ran too long');
}
if (inputMode === 'march-continuous-stop' && (!screen.includes('STOPPED') || wordAt(memory.ram, 0xf076) !== 1)) {
  errors.push('continuous VRAM March did not stop cleanly on 0');
}
if (inputMode === 'tanam-march') {
  if (!tanamPresent) errors.push('Tanam March input requires the Tanam memory model');
  if ((resultFlags & 0x0020) !== 0) errors.push('Tanam March-B reported a failure');
  if (wordAt(memory.lowTanam, 0) !== 0 || wordAt(memory.lowTanam, 0x1ffe) !== 0 ||
      wordAt(memory.highTanam, 0) !== 0 || wordAt(memory.highTanam, 0x1ffe) !== 0) {
    errors.push('Tanam March-B did not finish both complete windows in state zero');
  }
}
if (inputMode === 'tanam-continuous-stop' && (!screen.includes('STOPPED') || wordAt(memory.ram, 0xf076) !== 1)) {
  errors.push('continuous Tanam March did not stop cleanly on 0');
}
if (inputMode === 'credits' && (!screen.includes('Credits and Thanks') ||
    !screen.includes('Jon G. (hexbus)') || !screen.includes('Jim F. (Ksarul)') ||
    !screen.includes('Takeo N. (Tanam1972)') || !screen.includes('Rasmus M. (Rasmus)') ||
    !screen.includes('Mike B (Tursi)') || !screen.includes('Alan (Old CS1)') ||
    !screen.includes('MegaDemo team') ||
    !screen.includes('AtariAge TI-99 Forum'))) {
  errors.push('credits page is incomplete');
}
if (memory.unknownReads.size) errors.push(`unknown reads: ${Array.from(memory.unknownReads).map(x => x.toString(16))}`);
if (memory.unknownWrites.length) errors.push(`unknown writes: ${memory.unknownWrites.map(x => x.toString(16))}`);

const report = {
  schema: 'tutor-pyuuta-diagnostic-emulator-v1',
  image: path.basename(imagePath),
  region: expectedRegion,
  tanam_present: tanamPresent,
  injected_fault: fault,
  input_mode: inputMode,
  passed: errors.length === 0,
  errors,
  cpu: {pc: cpu.getPc() & 0xffff, cycles: cpu.getCycles()},
  results: {
    flags: wordAt(memory.ram, 0xf000),
    stage: wordAt(memory.ram, 0xf002),
    failure_address: wordAt(memory.ram, 0xf004),
    failure_expected: wordAt(memory.ram, 0xf006),
    failure_actual: wordAt(memory.ram, 0xf008),
    failure_mask: wordAt(memory.ram, 0xf00a),
    extension: wordAt(memory.ram, 0xf00c),
    vdp_frame: wordAt(memory.ram, 0xf00e),
    rom_sum_forward: wordAt(memory.ram, 0xf010),
    march_passes: wordAt(memory.ram, 0xf012),
    key_held: wordAt(memory.ram, 0xf014),
    key_count: wordAt(memory.ram, 0xf016),
    rom_sum_reverse: wordAt(memory.ram, 0xf018),
    vdp_status_flags: wordAt(memory.ram, 0xf01a),
    deep_vram_passes: wordAt(memory.ram, 0xf01c),
    visible_scrub_blocks: wordAt(memory.ram, 0xf072)
  },
  vdp: {data_writes: memory.vdp.dataWrites, data_reads: memory.vdp.dataReads,
    status_reads: memory.vdp.statusReads, registers: Array.from(memory.vdp.registers),
    register_write_count: memory.vdp.registerLog.length},
  psg_write_count: memory.soundWrites.length,
  cru_read_count: memory.cru.reads.size,
  cru_scan_count: memory.cru.scan,
  controller_columns_seen: Array.from(memory.cru.selectedColumnsSeen).sort(),
  screen,
  transient_screens: {
    vram_warning: memory.vdp.vramWarningSnapshot ? screenTextFromRam(memory.vdp.vramWarningSnapshot) : null,
    visible_scrub: memory.vdp.visibleScrubSnapshot ? screenTextFromRam(memory.vdp.visibleScrubSnapshot) : null
  }
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`PASS ${path.basename(imagePath)} ${tanamPresent ? 'with Tanam' : 'stock map'} ${fault} ${inputMode}`);
