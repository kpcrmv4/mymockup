// Minimal typings for the bundled qrcode.js (Kazuhiko Arase, MIT).
interface QRCodeModel {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
}

declare function qrcode(
  typeNumber: number,
  errorCorrectionLevel: "L" | "M" | "Q" | "H"
): QRCodeModel;

export default qrcode;
