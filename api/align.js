export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-colab-url, x-colab-model'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const colabUrl = req.headers['x-colab-url'];
  if (!colabUrl) {
    return res.status(400).send('Missing x-colab-url header');
  }

  const colabModel = req.headers['x-colab-model'] || 'whisperx';

  try {
    // Collect the raw request body stream
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const targetUrl = `${colabUrl.replace(/\/$/, '')}/align`;
    console.log(`Forwarding align request to: ${targetUrl} (Model: ${colabModel})`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'],
        'Bypass-Tunnel-Reminder': 'true',
        'x-colab-model': colabModel
      },
      body: buffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).send(errorText || 'Upstream server error');
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Proxy alignment failed:', err);
    return res.status(500).send('Proxy alignment failed: ' + err.message);
  }
}
