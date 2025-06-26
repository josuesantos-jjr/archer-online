let qrCodeData = {};
export function setQrCode(clientId, data) {
    qrCodeData[clientId] = data;
}
export function getQrCode(clientId) {
    return qrCodeData[clientId] || null;
}
export function clearQrCode(clientId) {
    delete qrCodeData[clientId];
}
