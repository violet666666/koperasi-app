/**
 * Web Serial API type declarations for USB thermal printer integration.
 * Chrome Android 89+, Chrome Desktop 89+.
 * Requires HTTPS (or localhost) and user gesture.
 */
interface SerialPortInfo {
  readonly usbVendorId?: number;
  readonly usbProductId?: number;
}

interface SerialPort {
  readonly info: SerialPortInfo;
  readonly readable: ReadableStream | null;
  readonly writable: WritableStream | null;
  open(options: SerialOpenOptions): Promise<void>;
  close(): Promise<void>;
  setSignals(signals: SerialOutputSignals): Promise<void>;
  getSignals(): Promise<SerialInputSignals>;
  addEventListener(type: "connect" | "disconnect", listener: (event: Event) => void): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  forget(): Promise<void>;
}

interface SerialOpenOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
  bufferSize?: number;
  flowControl?: "none" | "hardware";
}

interface SerialOutputSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

interface SerialInputSignals {
  readonly dataCarrierDetect: boolean;
  readonly clearToSend: boolean;
  readonly ringIndicator: boolean;
  readonly dataSetReady: boolean;
  readonly dataTerminalReady: boolean;
  readonly requestToSend: boolean;
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface Serial {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
  addEventListener(type: "connect", listener: (event: Event & { port: SerialPort }) => void): void;
  addEventListener(type: "disconnect", listener: (event: Event & { port: SerialPort }) => void): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface Navigator {
  readonly serial?: Serial;
}
