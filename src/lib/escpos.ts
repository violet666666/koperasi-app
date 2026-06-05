export interface EscPosOptions {
  paperSize?: "58mm" | "80mm";
  cutPaper?: boolean;
  feedLines?: number;
}

// ESC/POS command builders

export function cmdInit(): number[] {
  return [0x1b, 0x40];
}

export function cmdCenterAlign(): number[] {
  return [0x1b, 0x61, 0x01];
}

export function cmdLeftAlign(): number[] {
  return [0x1b, 0x61, 0x00];
}

export function cmdRightAlign(): number[] {
  return [0x1b, 0x61, 0x02];
}

export function cmdBoldOn(): number[] {
  return [0x1b, 0x45, 0x01];
}

export function cmdBoldOff(): number[] {
  return [0x1b, 0x45, 0x00];
}

export function cmdFeedLines(n: number): number[] {
  return [0x1b, 0x64, n];
}

export function cmdCutPaper(): number[] {
  return [0x1d, 0x56, 0x00];
}

export function cmdUnderlineOn(): number[] {
  return [0x1b, 0x2d, 0x01];
}

export function cmdUnderlineOff(): number[] {
  return [0x1b, 0x2d, 0x00];
}

function isCenteredLine(line: string): boolean {
  if (line.length === 0) return false;
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (/^-+$/.test(trimmed)) return false;
  const leadingSpaces = line.length - line.trimStart().length;
  const trailingSpaces = line.length - line.trimEnd().length;
  return leadingSpaces > 0 && trailingSpaces > 0;
}

function isDashLine(line: string): boolean {
  return /^-+$/.test(line.trim());
}

function isTotalLine(line: string): boolean {
  return line.includes("TOTAL");
}

export function textToEscPos(
  text: string,
  options: EscPosOptions = {}
): Uint8Array {
  const {
    cutPaper = true,
    feedLines = 4,
  } = options;

  const encoder = new TextEncoder();
  const bytes: number[] = [...cmdInit()];

  const lines = text.split("\n");

  for (const line of lines) {
    if (isCenteredLine(line)) {
      bytes.push(...cmdCenterAlign());
      bytes.push(...encoder.encode(line.trim()));
      bytes.push(...cmdLeftAlign());
    } else if (isTotalLine(line)) {
      bytes.push(...cmdBoldOn());
      bytes.push(...encoder.encode(line));
      bytes.push(...cmdBoldOff());
    } else {
      bytes.push(...encoder.encode(line));
    }

    bytes.push(0x0a); // newline
  }

  bytes.push(...cmdFeedLines(feedLines));

  if (cutPaper) {
    bytes.push(...cmdCutPaper());
  }

  return new Uint8Array(bytes);
}

export function chunkBytes(
  data: Uint8Array,
  chunkSize: number = 100
): Uint8Array[] {
  if (data.length === 0) return [];

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, data.length);
    chunks.push(new Uint8Array(data.buffer, data.byteOffset + i, end - i));
  }
  return chunks;
}
