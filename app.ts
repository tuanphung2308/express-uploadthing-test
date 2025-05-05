import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import cors from 'cors'; // Import cors
import express from 'express';

const app = express();
const port: number = parseInt(process.env.PORT || '3001', 10);

import { File } from '@web-std/file';
import { createRouteHandler } from 'uploadthing/express';
import { UTApi } from 'uploadthing/server';
import { uploadRouter } from './uploadthing';

const utapi = new UTApi();

app.use(cors()); // Use cors middleware
app.use(express.json({ limit: '10mb' })); // Add JSON middleware for parsing request body, increase limit slightly for base64

app.use(
  '/api/uploadthing',
  createRouteHandler({
    router: uploadRouter,
    // config: { logger: { level: 'debug' } },
  })
);

// Explicitly type the handler function
const handleBase64Upload: express.RequestHandler = async (req, res) => {
  try {
    const { file } = req.body; // Expecting { "file": "data:image/png;base64,..." }

    if (!file || typeof file !== 'string') {
      res
        .status(400)
        .json({ error: 'Missing or invalid base64 file string in body' });
      return;
    }

    const match = file.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      res.status(400).json({ error: 'Invalid base64 string format' });
      return;
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const fileBuffer = Buffer.from(base64Data, 'base64');

    const fileName = `upload-${Date.now()}.${mimeType.split('/')[1] || 'bin'}`;
    const blob = new File([fileBuffer], fileName, { type: mimeType });

    console.log(
      `Uploading file: ${fileName}, size: ${fileBuffer.length}, type: ${mimeType}`
    );

    const uploadResponse = await utapi.uploadFiles([blob]);

    const uploadedFile = uploadResponse[0];
    if (uploadedFile.error) {
      console.error('UploadThing Error:', uploadedFile.error);
      res
        .status(500)
        .json({ error: 'Upload failed', details: uploadedFile.error });
      return;
    }

    console.log('Upload successful:', uploadedFile.data);

    res.status(200).json({ url: uploadedFile.data.ufsUrl });
  } catch (error) {
    console.error('Error handling base64 upload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

app.post('/api/upload-base64', handleBase64Upload);

const server = app.listen(port, () =>
  console.log(`Example app listening on port ${port}!`)
);

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
