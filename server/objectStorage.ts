import { Storage, File } from '@google-cloud/storage';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { logger } from './utils/production-safe-logger';

// Initialize Google Cloud Storage with service account credentials
// For Firebase/GCP: Uses GOOGLE_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY
let objectStorageClient: Storage;

try {
  const projectId = process.env.GOOGLE_PROJECT_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    // Firebase/GCP: Use service account credentials
    objectStorageClient = new Storage({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });
    logger.info('Google Cloud Storage initialized with service account credentials');
  } else {
    // Fallback: Use default credentials (will work on GCP with default service account)
    objectStorageClient = new Storage();
    logger.warn('Google Cloud Storage initialized with default credentials. Set GOOGLE_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY for explicit authentication.');
  }
} catch (error) {
  logger.error('Failed to initialize Google Cloud Storage', { error });
  // Create a fallback instance
  objectStorageClient = new Storage();
}

export { objectStorageClient };

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  private static instance: ObjectStorageService;

  static getInstance(): ObjectStorageService {
    if (!ObjectStorageService.instance) {
      ObjectStorageService.instance = new ObjectStorageService();
    }
    return ObjectStorageService.instance;
  }

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
    const paths = Array.from(
      new Set(
        pathsStr
          .split(',')
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          'tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths).'
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.'
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();

      // Set appropriate headers
      res.set({
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Length': metadata.size,
        'Cache-Control': `public, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on('error', (err) => {
        logger.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });

      stream.pipe(res);
    } catch (error) {
      logger.error('Error downloading file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.'
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: 'PUT',
      ttlSec: 900,
    });
  }

  // Upload a local file to object storage and return the public URL
  async uploadLocalFile(localFilePath: string, destKey: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/${destKey}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    try {
      // Upload the file
      await bucket.upload(localFilePath, {
        destination: objectName,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      logger.info('File uploaded successfully', { destKey, objectName });

      // Return a Google Cloud Storage URL that can be proxied
      // The /api/objects/proxy endpoint will handle serving this file
      return `https://storage.googleapis.com/${bucketName}/${objectName}`;
    } catch (error) {
      logger.error('Error uploading file to object storage', { error, destKey });
      throw new Error('Failed to upload file to object storage');
    }
  }
}

// Export a singleton instance for convenience
export const objectStorageService = ObjectStorageService.getInstance();

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const pathParts = path.split('/');
  if (pathParts.length < 3) {
    throw new Error('Invalid path: must contain at least a bucket name');
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join('/');

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  ttlSec: number;
}): Promise<string> {
  try {
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    // Generate signed URL using Google Cloud Storage SDK
    const options = {
      version: 'v4' as const,
      action: method.toLowerCase() as 'read' | 'write' | 'delete',
      expires: Date.now() + ttlSec * 1000,
    };

    const [signedUrl] = await file.getSignedUrl(options);
    return signedUrl;
  } catch (error) {
    logger.error('Failed to sign object URL', { error, bucketName, objectName, method });
    throw new Error(
      `Failed to sign object URL. Ensure Google Cloud credentials are properly configured.`
    );
  }
}
