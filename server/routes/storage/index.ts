import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createStandardMiddleware, createErrorHandler } from '../../middleware';
import { logger } from '../../middleware/logger';
import { insertConfidentialDocumentSchema } from '@shared/schema';
import { storage } from '../../storage-wrapper';

// Type definitions for authentication
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    permissions?: string[];
  };
  session?: {
    user?: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      permissions?: string[];
    };
  };
}

// Custom multer configuration for confidential documents
const confidentialDocumentsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'attached_assets/CONFIDENTIAL';
      // Ensure the directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename while preserving extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      const uniqueFilename = `${baseName}-${uniqueSuffix}${ext}`;
      cb(null, uniqueFilename);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document types for confidential documents
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/csv',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported for confidential document uploads. Supported types: PDF, Word, Excel, PowerPoint, images, text, and CSV files.'));
    }
  },
});

// Create storage routes router
const storageRouter = Router();

// Apply standard middleware (authentication, logging, sanitization)
storageRouter.use(createStandardMiddleware());

// Error handling for this module
const errorHandler = createErrorHandler('storage');

// Helper function to get user from request
const getUser = (req: AuthenticatedRequest) => {
  return req.user || req.session?.user;
};

// GET /api/storage/confidential - List user's accessible confidential documents
storageRouter.get('/confidential', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info(`Fetching confidential documents for user: ${user.email}`);

    const documents = await storage.getConfidentialDocumentsForUser(user.email);
    
    res.json({ documents });
  } catch (error: any) {
    logger.error('Error fetching confidential documents:', error);
    res.status(500).json({ error: 'Failed to fetch confidential documents' });
  }
});

// POST /api/storage/confidential - Upload new confidential document
storageRouter.post('/confidential', 
  confidentialDocumentsUpload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);
      
      if (!user || !user.email) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { allowedEmails } = req.body;
      
      if (!allowedEmails || !Array.isArray(allowedEmails)) {
        return res.status(400).json({ error: 'allowedEmails must be provided as an array' });
      }

      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (const email of allowedEmails) {
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: `Invalid email address: ${email}` });
        }
      }

      logger.info(`Creating confidential document: ${req.file.originalname} for user: ${user.email}`);

      const documentData = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        allowedEmails: allowedEmails,
        uploadedBy: user.id,
      };

      // Validate the document data
      const validatedData = insertConfidentialDocumentSchema.parse(documentData);
      
      const document = await storage.createConfidentialDocument(validatedData);
      
      logger.info(`Confidential document created successfully with ID: ${document.id}`);
      
      res.status(201).json({ document });
    } catch (error: any) {
      logger.error('Error creating confidential document:', error);
      
      // Clean up uploaded file if document creation failed
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          logger.info(`Cleaned up uploaded file: ${req.file.path}`);
        } catch (cleanupError) {
          logger.error('Error cleaning up uploaded file:', cleanupError);
        }
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Invalid document data', details: error.errors });
      }
      
      res.status(500).json({ error: 'Failed to create confidential document' });
    }
  }
);

// GET /api/storage/confidential/:id/download - Download specific confidential document
storageRouter.get('/confidential/:id/download', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const documentId = parseInt(req.params.id);
    
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    logger.info(`Downloading confidential document ${documentId} for user: ${user.email}`);

    const document = await storage.getConfidentialDocumentById(documentId, user.email);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // Check if file exists on disk
    if (!fs.existsSync(document.filePath)) {
      logger.error(`File not found on disk: ${document.filePath}`);
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream the file to the client
    const fileStream = fs.createReadStream(document.filePath);
    fileStream.pipe(res);
    
    logger.info(`Confidential document ${documentId} downloaded successfully by user: ${user.email}`);
  } catch (error: any) {
    logger.error('Error downloading confidential document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// DELETE /api/storage/confidential/:id - Delete confidential document
storageRouter.delete('/confidential/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = getUser(req);
    
    if (!user || !user.email) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const documentId = parseInt(req.params.id);
    
    if (isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    logger.info(`Deleting confidential document ${documentId} for user: ${user.email}`);

    // Get document first to get file path for cleanup
    const document = await storage.getConfidentialDocumentById(documentId, user.email);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // Only allow deletion if user is the uploader or has admin privileges
    if (document.uploadedBy !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the uploader or admin can delete this document' });
    }

    const deleted = await storage.deleteConfidentialDocument(documentId, user.email);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // Clean up the file from disk
    if (fs.existsSync(document.filePath)) {
      try {
        fs.unlinkSync(document.filePath);
        logger.info(`Cleaned up file: ${document.filePath}`);
      } catch (fileError) {
        logger.error('Error cleaning up file:', fileError);
        // Don't fail the request if file cleanup fails
      }
    }

    logger.info(`Confidential document ${documentId} deleted successfully by user: ${user.email}`);
    
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting confidential document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Apply error handling middleware
storageRouter.use(errorHandler);

export default storageRouter;