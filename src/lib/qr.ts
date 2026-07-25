import QRCode from "qrcode";

export async function toQrDataUrl(text: string, size = 220): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: "#0f2244", light: "#ffffff" },
  });
}
