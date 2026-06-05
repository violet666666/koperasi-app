import { describe, it, expect } from "vitest";
import {
  cmdInit,
  cmdCenterAlign,
  cmdLeftAlign,
  cmdRightAlign,
  cmdBoldOn,
  cmdBoldOff,
  cmdFeedLines,
  cmdCutPaper,
  cmdUnderlineOn,
  cmdUnderlineOff,
  textToEscPos,
  chunkBytes,
} from "@/lib/escpos";

describe("cmdInit", () => {
  it("returns ESC @ sequence", () => {
    expect(cmdInit()).toEqual([0x1b, 0x40]);
  });
});

describe("cmdCenterAlign", () => {
  it("returns ESC a 1 sequence", () => {
    expect(cmdCenterAlign()).toEqual([0x1b, 0x61, 0x01]);
  });
});

describe("cmdLeftAlign", () => {
  it("returns ESC a 0 sequence", () => {
    expect(cmdLeftAlign()).toEqual([0x1b, 0x61, 0x00]);
  });
});

describe("cmdRightAlign", () => {
  it("returns ESC a 2 sequence", () => {
    expect(cmdRightAlign()).toEqual([0x1b, 0x61, 0x02]);
  });
});

describe("cmdBoldOn", () => {
  it("returns ESC E 1 sequence", () => {
    expect(cmdBoldOn()).toEqual([0x1b, 0x45, 0x01]);
  });
});

describe("cmdBoldOff", () => {
  it("returns ESC E 0 sequence", () => {
    expect(cmdBoldOff()).toEqual([0x1b, 0x45, 0x00]);
  });
});

describe("cmdFeedLines", () => {
  it("returns ESC d n sequence", () => {
    expect(cmdFeedLines(4)).toEqual([0x1b, 0x64, 4]);
    expect(cmdFeedLines(1)).toEqual([0x1b, 0x64, 1]);
  });
});

describe("cmdCutPaper", () => {
  it("returns GS V 0 sequence", () => {
    expect(cmdCutPaper()).toEqual([0x1d, 0x56, 0x00]);
  });
});

describe("cmdUnderlineOn", () => {
  it("returns ESC - 1 sequence", () => {
    expect(cmdUnderlineOn()).toEqual([0x1b, 0x2d, 0x01]);
  });
});

describe("cmdUnderlineOff", () => {
  it("returns ESC - 0 sequence", () => {
    expect(cmdUnderlineOff()).toEqual([0x1b, 0x2d, 0x00]);
  });
});

describe("textToEscPos", () => {
  it("starts with init and ends with feed + cut", () => {
    const result = textToEscPos("Hello");
    const arr = Array.from(result);

    expect(arr.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(arr.slice(-3)).toEqual([0x1d, 0x56, 0x00]);

    const feedIdx = arr.length - 3 - 3;
    expect(arr.slice(feedIdx, feedIdx + 3)).toEqual([0x1b, 0x64, 4]);
  });

  it("includes plain text bytes", () => {
    const result = textToEscPos("Hi");
    const arr = Array.from(result);
    const textBytes = [...new TextEncoder().encode("Hi"), 0x0a];

    expect(arr.slice(2, 2 + textBytes.length)).toEqual(textBytes);
  });

  it("detects centered lines and emits center align commands", () => {
    const centeredLine = "        PRIMKOPPOL RESOR LUMAJANG        ";
    const result = textToEscPos(centeredLine);
    const arr = Array.from(result);

    const centerCmd = [0x1b, 0x61, 0x01];
    const leftCmd = [0x1b, 0x61, 0x00];
    const trimmed = [...new TextEncoder().encode("PRIMKOPPOL RESOR LUMAJANG")];

    const expected = [...centerCmd, ...trimmed, ...leftCmd, 0x0a];
    expect(arr.slice(2, 2 + expected.length)).toEqual(expected);
  });

  it("detects TOTAL line and wraps with bold", () => {
    const totalLine = "TOTAL     : Rp50.000";
    const result = textToEscPos(totalLine);
    const arr = Array.from(result);

    const boldOn = [0x1b, 0x45, 0x01];
    const boldOff = [0x1b, 0x45, 0x00];
    const text = [...new TextEncoder().encode(totalLine)];

    const expected = [...boldOn, ...text, ...boldOff, 0x0a];
    expect(arr.slice(2, 2 + expected.length)).toEqual(expected);
  });

  it("emits dash separator lines as-is", () => {
    const dashLine = "------------------------------------------------";
    const result = textToEscPos(dashLine);
    const arr = Array.from(result);

    const text = [...new TextEncoder().encode(dashLine), 0x0a];
    expect(arr.slice(2, 2 + text.length)).toEqual(text);
  });

  it("omits cut command when cutPaper is false", () => {
    const result = textToEscPos("Test", { cutPaper: false });
    const arr = Array.from(result);
    const cutCmd = [0x1d, 0x56, 0x00];

    expect(arr.slice(-3)).not.toEqual(cutCmd);
    expect(arr.slice(-3)).toEqual([0x1b, 0x64, 4]);
  });

  it("uses custom feedLines count", () => {
    const result = textToEscPos("X", { feedLines: 2, cutPaper: false });
    const arr = Array.from(result);

    expect(arr.slice(-3)).toEqual([0x1b, 0x64, 2]);
  });

  it("handles multi-line receipt with mixed formatting", () => {
    const text = [
      "        PRIMKOPPOL RESOR LUMAJANG        ",
      "------------------------------------------------",
      "No. Nota: TOKO-001                          ",
      "TOTAL     : Rp50.000",
      "        Terima kasih        ",
    ].join("\n");

    const result = textToEscPos(text);
    const arr = Array.from(result);

    expect(arr.slice(0, 2)).toEqual([0x1b, 0x40]);

    const hasCenter = arr.some(
      (b, i) => b === 0x1b && arr[i + 1] === 0x61 && arr[i + 2] === 0x01
    );
    expect(hasCenter).toBe(true);

    const hasBold = arr.some(
      (b, i) => b === 0x1b && arr[i + 1] === 0x45 && arr[i + 2] === 0x01
    );
    expect(hasBold).toBe(true);

    expect(arr.slice(-3)).toEqual([0x1d, 0x56, 0x00]);
  });
});

describe("chunkBytes", () => {
  it("splits data into correct chunk sizes", () => {
    const data = new Uint8Array(250);
    const chunks = chunkBytes(data, 100);

    expect(chunks).toHaveLength(3);
    expect(chunks[0].length).toBe(100);
    expect(chunks[1].length).toBe(100);
    expect(chunks[2].length).toBe(50);
  });

  it("returns single chunk when data fits", () => {
    const data = new Uint8Array(50);
    const chunks = chunkBytes(data, 100);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBe(50);
  });

  it("returns empty array for empty data", () => {
    const data = new Uint8Array(0);
    const chunks = chunkBytes(data);

    expect(chunks).toHaveLength(0);
  });

  it("preserves byte values across chunks", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const chunks = chunkBytes(data, 3);

    expect(chunks).toHaveLength(4);
    expect(Array.from(chunks[0])).toEqual([1, 2, 3]);
    expect(Array.from(chunks[1])).toEqual([4, 5, 6]);
    expect(Array.from(chunks[2])).toEqual([7, 8, 9]);
    expect(Array.from(chunks[3])).toEqual([10]);
  });

  it("uses default chunkSize of 100", () => {
    const data = new Uint8Array(150);
    const chunks = chunkBytes(data);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].length).toBe(100);
    expect(chunks[1].length).toBe(50);
  });
});
