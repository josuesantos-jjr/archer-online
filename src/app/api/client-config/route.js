export const dynamic = 'force-dynamic';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Client ID is required' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Parse the client path from the ID (e.g., "ativos/Alpha")
    const parts = clientId.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return new Response(
        JSON.stringify({ error: 'Invalid Client ID format. Expected "folderType/clientName".' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }
    const [folderType, clientName] = parts;

    const infoClientePath = path.join(
      process.cwd(),
      'clientes',
      folderType,
      clientName,
      'config',
      'infoCliente.json'
    );
 
    try {
      const infoClienteContent = await fs.readFile(infoClientePath, 'utf-8');
      const config = JSON.parse(infoClienteContent);
 
      // Format QR code for display
      if (config.QR_CODE) {
        try {
          // Remove surrounding quotes if present
          const qrCode = config.QR_CODE.trim().replace(/^['"]|['"]$/g, '');
 
          // Split the comma-separated values and format them nicely for display
          const parts = qrCode.split(',').map((part) => part.trim());
          config.QR_CODE = parts.join('\n');
        } catch (error) {
          console.error('Error processing QR code:', error);
          config.QR_CODE = '';
        }
      }
 
      // Default values for required fields
      config.STATUS_SESSION = config.STATUS_SESSION || 'disconnected';
 
      // Format connection status for display
      config.STATUS_SESSION = config.STATUS_SESSION.toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
 
      return new Response(JSON.stringify(config), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      console.error('Error reading client config from infoCliente.json:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to read client configuration from infoCliente.json',
          details: error.message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error fetching client config:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch client configuration',
        details: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
