import { put, list } from '@vercel/blob';

const BLOB_KEY = 'leavesync-data.json';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── GET: read all data from blob ──
  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: BLOB_KEY });
      if (blobs.length === 0) {
        return res.status(200).json(null);
      }
      // Fetch the blob content by its URL
      const response = await fetch(blobs[0].url);
      if (!response.ok) {
        return res.status(200).json(null);
      }
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error reading blob:', error);
      return res.status(200).json(null);
    }
  }

  // ── PUT: save data to blob ──
  if (req.method === 'PUT') {
    try {
      const data = req.body;
      await put(BLOB_KEY, JSON.stringify(data), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error writing blob:', error);
      return res.status(500).json({ error: 'Failed to save data' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
