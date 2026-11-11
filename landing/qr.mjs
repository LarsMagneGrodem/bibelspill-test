// Made by tools/koder/lag-qr.mjs from src/app/qr.ts. Do not edit; run the tool instead.
// A QR code for the game's address on the diploma and the story pictures (keepsake.ts): byte mode, error correction
// level M (a printed diploma on a fridge may get a smudge), versions 1–10, which hold up to 213 bytes. The steps and
// tables follow ISO/IEC 18004 as Project Nayuki's reference encoder lays them out; tests/qr.test.ts checks every
// module against the `qrcode` package the unlock slips are printed with. Its own code, so the game needs no package.
const EC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
export const MAX_VERSION = 10;
const bit = (value, i) => ((value >>> i) & 1) !== 0;
// The modules left for data once the finder, timing and alignment patterns and the format and version bits are placed.
function rawModules(version) {
    let n = (16 * version + 128) * version + 64;
    if (version >= 2) {
        const align = Math.floor(version / 7) + 2;
        n -= (25 * align - 10) * align - 55;
        if (version >= 7)
            n -= 36;
    }
    return n;
}
const dataCodewords = (version) => Math.floor(rawModules(version) / 8) - EC_PER_BLOCK[version] * BLOCKS[version];
// Multiplication in GF(2⁸) with the QR polynomial x⁸ + x⁴ + x³ + x² + 1.
function times(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}
export function reedSolomon(data, degree) {
    const divisor = Array(degree).fill(0);
    divisor[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            divisor[j] = times(divisor[j], root);
            if (j + 1 < degree)
                divisor[j] ^= divisor[j + 1];
        }
        root = times(root, 0x02);
    }
    const rest = Array(degree).fill(0);
    for (const b of data) {
        const factor = b ^ rest.shift();
        rest.push(0);
        divisor.forEach((d, i) => (rest[i] ^= times(d, factor)));
    }
    return rest;
}
// The data codewords: mode, length, the bytes, a terminator and padding.
function codewords(bytes, version) {
    const bits = [];
    const put = (value, length) => { for (let i = length - 1; i >= 0; i--)
        bits.push((value >>> i) & 1); };
    put(0b0100, 4);
    put(bytes.length, version < 10 ? 8 : 16);
    for (const b of bytes)
        put(b, 8);
    const capacity = dataCodewords(version) * 8;
    put(0, Math.min(4, capacity - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11)
        put(pad, 8);
    const out = [];
    for (let i = 0; i < bits.length; i += 8)
        out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    return out;
}
// The data split into blocks, each with its error correction, and read across the blocks.
function interleaved(data, version) {
    const [count, ec] = [BLOCKS[version], EC_PER_BLOCK[version]];
    const raw = Math.floor(rawModules(version) / 8);
    const short = count - (raw % count);
    const shortLength = Math.floor(raw / count);
    const blocks = [];
    for (let i = 0, k = 0; i < count; i++) {
        const part = data.slice(k, k + shortLength - ec + (i < short ? 0 : 1));
        k += part.length;
        const check = reedSolomon(part, ec);
        if (i < short)
            part.push(0);
        blocks.push([...part, ...check]);
    }
    const out = [];
    for (let i = 0; i < blocks[0].length; i++)
        blocks.forEach((block, j) => { if (i !== shortLength - ec || j >= short)
            out.push(block[i]); });
    return out;
}
const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];
// The 15 format bits for level M (00) and a mask, with their BCH check, as the standard's table has them.
export function formatBits(mask) {
    const data = mask;
    let rest = data;
    for (let i = 0; i < 10; i++)
        rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
    return ((data << 10) | rest) ^ 0x5412;
}
class Grid {
    version;
    size;
    dark;
    fixed;
    constructor(version) {
        this.version = version;
        this.size = version * 4 + 17;
        this.dark = Array.from({ length: this.size }, () => Array(this.size).fill(false));
        this.fixed = Array.from({ length: this.size }, () => Array(this.size).fill(false));
        for (let i = 0; i < this.size; i++) {
            this.set(6, i, i % 2 === 0);
            this.set(i, 6, i % 2 === 0);
        }
        for (const [x, y] of [[3, 3], [this.size - 4, 3], [3, this.size - 4]])
            this.finder(x, y);
        const at = this.alignments();
        at.forEach((x, i) => at.forEach((y, j) => {
            const corner = (i === 0 && j === 0) || (i === 0 && j === at.length - 1) || (i === at.length - 1 && j === 0);
            if (!corner)
                for (let dy = -2; dy <= 2; dy++)
                    for (let dx = -2; dx <= 2; dx++)
                        this.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }));
        this.format(0);
        if (version >= 7) {
            let rest = version;
            for (let i = 0; i < 12; i++)
                rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
            const bits = (version << 12) | rest;
            for (let i = 0; i < 18; i++) {
                const [a, b] = [this.size - 11 + (i % 3), Math.floor(i / 3)];
                this.set(a, b, bit(bits, i));
                this.set(b, a, bit(bits, i));
            }
        }
    }
    set(x, y, dark) {
        this.dark[y][x] = dark;
        this.fixed[y][x] = true;
    }
    finder(cx, cy) {
        for (let dy = -4; dy <= 4; dy++)
            for (let dx = -4; dx <= 4; dx++) {
                const [x, y, d] = [cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy))];
                if (x >= 0 && x < this.size && y >= 0 && y < this.size)
                    this.set(x, y, d !== 2 && d !== 4);
            }
    }
    alignments() {
        if (this.version === 1)
            return [];
        const count = Math.floor(this.version / 7) + 2;
        const step = Math.ceil((this.version * 4 + 4) / (count * 2 - 2)) * 2;
        const at = [6];
        for (let pos = this.size - 7; at.length < count; pos -= step)
            at.splice(1, 0, pos);
        return at;
    }
    format(mask) {
        const bits = formatBits(mask);
        for (let i = 0; i <= 5; i++)
            this.set(8, i, bit(bits, i));
        this.set(8, 7, bit(bits, 6));
        this.set(8, 8, bit(bits, 7));
        this.set(7, 8, bit(bits, 8));
        for (let i = 9; i < 15; i++)
            this.set(14 - i, 8, bit(bits, i));
        for (let i = 0; i < 8; i++)
            this.set(this.size - 1 - i, 8, bit(bits, i));
        for (let i = 8; i < 15; i++)
            this.set(8, this.size - 15 + i, bit(bits, i));
        this.set(8, this.size - 8, true);
    }
    // The codewords in the zigzag of two-module columns, from the bottom right, skipping the timing column.
    fill(data) {
        let i = 0;
        for (let right = this.size - 1; right >= 1; right -= 2) {
            if (right === 6)
                right = 5;
            for (let vert = 0; vert < this.size; vert++)
                for (let j = 0; j < 2; j++) {
                    const x = right - j;
                    const y = ((right + 1) & 2) === 0 ? this.size - 1 - vert : vert;
                    if (!this.fixed[y][x] && i < data.length * 8) {
                        this.dark[y][x] = bit(data[i >>> 3], 7 - (i & 7));
                        i++;
                    }
                }
        }
    }
    mask(mask) {
        const test = MASKS[mask];
        for (let y = 0; y < this.size; y++)
            for (let x = 0; x < this.size; x++)
                if (!this.fixed[y][x] && test(x, y))
                    this.dark[y][x] = !this.dark[y][x];
    }
    // The standard's penalty for runs, 2×2 blocks, finder-like patterns and an uneven share of dark modules.
    penalty() {
        const n = this.size;
        let score = 0;
        const line = (at) => {
            let [colour, run] = [false, 0];
            const history = Array(7).fill(0);
            const add = (length) => { history.pop(); history.unshift(history[0] === 0 ? length + n : length); };
            const finders = () => {
                const m = history[1];
                const core = m > 0 && history[2] === m && history[3] === m * 3 && history[4] === m && history[5] === m;
                return (core && history[0] >= m * 4 && history[6] >= m ? 1 : 0) + (core && history[6] >= m * 4 && history[0] >= m ? 1 : 0);
            };
            for (let i = 0; i < n; i++) {
                if (at(i) === colour) {
                    run += 1;
                    if (run === 5)
                        score += 3;
                    else if (run > 5)
                        score += 1;
                }
                else {
                    add(run);
                    if (!colour)
                        score += finders() * 40;
                    [colour, run] = [at(i), 1];
                }
            }
            if (colour) {
                add(run);
                run = 0;
            }
            add(run + n);
            score += finders() * 40;
        };
        for (let y = 0; y < n; y++)
            line((x) => this.dark[y][x]);
        for (let x = 0; x < n; x++)
            line((y) => this.dark[y][x]);
        let dark = 0;
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
                const c = this.dark[y][x];
                if (c)
                    dark += 1;
                if (x < n - 1 && y < n - 1 && c === this.dark[y][x + 1] && c === this.dark[y + 1][x] && c === this.dark[y + 1][x + 1])
                    score += 3;
            }
        return score + (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
    }
}
// The modules of the smallest symbol that holds the text, dark as true, row by row; with `mask` the given mask, else the
// one with the lowest penalty. Null when the text is too long for version 10.
export function qrCode(text, mask) {
    const bytes = new TextEncoder().encode(text);
    let version = 1;
    while (version <= MAX_VERSION && 4 + (version < 10 ? 8 : 16) + bytes.length * 8 > dataCodewords(version) * 8)
        version += 1;
    if (version > MAX_VERSION)
        return null;
    const symbol = new Grid(version);
    symbol.fill(interleaved(codewords(bytes, version), version));
    let chosen = mask ?? 0;
    if (mask === undefined) {
        let best = Infinity;
        for (let m = 0; m < 8; m++) {
            symbol.mask(m);
            symbol.format(m);
            const score = symbol.penalty();
            if (score < best)
                [best, chosen] = [score, m];
            symbol.mask(m);
        }
    }
    symbol.mask(chosen);
    symbol.format(chosen);
    return { dark: symbol.dark, version, mask: chosen };
}
