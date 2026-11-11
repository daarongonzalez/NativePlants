/**
 * A small PNG reader for the aerial photo, using only what a Cloudflare
 * Worker provides (DecompressionStream). No image library is needed.
 *
 * Handles what the photo service sends: 8-bit, non-interlaced greyscale, RGB
 * or RGBA. Anything else is refused rather than misread.
 */

export interface DecodedPng {
  width: number;
  height: number;
  /** Values per pixel: 1 (grey), 3 (RGB) or 4 (RGBA). */
  channels: number;
  /** Row by row, `channels` bytes per pixel. */
  data: Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 6: 4 };

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export async function decodePng(input: ArrayBuffer | Uint8Array): Promise<DecodedPng> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error("not a PNG");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Uint8Array[] = [];

  for (let pos = 8; pos + 8 <= bytes.length; ) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!);
    const body = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      const depth = body[8]!;
      const colour = body[9]!;
      const interlace = body[12]!;
      channels = CHANNELS[colour] ?? 0;
      if (depth !== 8 || channels === 0 || interlace !== 0) {
        throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}, interlace ${interlace}`);
      }
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }
  if (width === 0 || idat.length === 0) throw new Error("PNG has no image data");

  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  let offset = 0;
  for (const c of idat) {
    joined.set(c, offset);
    offset += c.length;
  }
  const raw = await inflate(joined);

  const stride = width * channels;
  if (raw.length < height * (stride + 1)) throw new Error("PNG image data is short");
  const data = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const src = y * (stride + 1) + 1;
    const out = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x]!;
      const a = x >= channels ? data[out + x - channels]! : 0;
      const b = y > 0 ? data[out - stride + x]! : 0;
      const c = x >= channels && y > 0 ? data[out - stride + x - channels]! : 0;
      let r: number;
      switch (filter) {
        case 0:
          r = v;
          break;
        case 1:
          r = v + a;
          break;
        case 2:
          r = v + b;
          break;
        case 3:
          r = v + ((a + b) >> 1);
          break;
        case 4:
          r = v + paeth(a, b, c);
          break;
        default:
          throw new Error(`unknown PNG filter ${filter}`);
      }
      data[out + x] = r & 0xff;
    }
  }
  return { width, height, channels, data };
}
