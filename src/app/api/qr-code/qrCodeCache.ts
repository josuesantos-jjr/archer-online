let qrCodeData: { [clientId: string]: string | null } = {};

export function setQrCode(clientId: string, data: string | null) {
  qrCodeData[clientId] = data;
}

export function getQrCode(clientId: string): string | null {
  return qrCodeData[clientId] || null;
}

export function clearQrCode(clientId: string) {
  delete qrCodeData[clientId];
}