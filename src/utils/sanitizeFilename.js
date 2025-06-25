/**
 * Sanitiza um nome de arquivo removendo caracteres inválidos e espaços extras
 * @param {string} filename Nome do arquivo a ser sanitizado
 * @returns {string} Nome do arquivo sanitizado
 */
const sanitizeFilename = (filename) => {
  if (!filename) return '';

  // Remove caracteres não permitidos em nomes de arquivo
  const sanitized = filename
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove caracteres especiais
    .replace(/^\.+/, '') // Remove pontos no início
    .replace(/[. ]+$/, '') // Remove pontos e espaços no final
    .replace(/[ ]+/g, '_'); // Substitui espaços por underscores

  // Limita o tamanho do nome do arquivo
  const MAX_LENGTH = 255;
  if (sanitized.length > MAX_LENGTH) {
    const ext = sanitized.lastIndexOf('.');
    if (ext === -1) {
      return sanitized.substring(0, MAX_LENGTH);
    }
    const name = sanitized.substring(0, ext);
    const extension = sanitized.substring(ext);
    return name.substring(0, MAX_LENGTH - extension.length) + extension;
  }

  return sanitized;
};

export { sanitizeFilename };
