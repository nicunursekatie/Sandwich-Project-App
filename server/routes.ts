import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage-wrapper";
import { createActivityLogger } from "./middleware/activity-logger";
import createMainRoutes from "./routes/index";
import { requirePermission } from "./middleware/auth";

// Function to create event reminders routes (minimal implementation)
function createEventRemindersRoutes(isAuthenticated: any, activityLogger: any) {
  const router = express.Router();
  // Event reminders routes implementation would go here
  // This is a placeholder to maintain functionality
  return router;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Use database-backed session store for deployment persistence
  const PgSession = connectPg(session);
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds (matches cookie maxAge)
    tableName: "sessions",
  });

  // Add CORS middleware before session middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Secure CORS handling - no wildcard with credentials
    const allowedOrigins = [
      'https://localhost:5000',
      'https://127.0.0.1:5000'
    ];
    
    // Add Replit dev origins dynamically
    if (origin && origin.includes('.replit.dev')) {
      allowedOrigins.push(origin);
    }
    
    if (process.env.NODE_ENV === 'development') {
      // In development, allow specific dev origins only
      if (origin && (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        res.header('Access-Control-Allow-Origin', origin);
      } else if (!origin) {
        // Allow same-origin requests (no origin header)
        res.header('Access-Control-Allow-Origin', 'null');
      }
    } else {
      // In production, only allow known secure origins
      if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      }
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Cache-Control,Pragma');
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Add session middleware with enhanced security
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "temp-secret-key-for-development",
      resave: true, // Force session save on every request to prevent data loss
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks by blocking client-side access
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for extended user sessions
        sameSite: "lax", // CSRF protection
        domain: undefined, // Let Express auto-detect domain for Replit
      },
      name: "tsp.session", // Custom session name
      rolling: true, // Reset maxAge on every request to keep active sessions alive
    }),
  );

  // Setup temporary authentication (stable and crash-free)
  const {
    setupTempAuth,
    isAuthenticated,
    initializeTempAuth,
  } = await import("./temp-auth");
  setupTempAuth(app);

  // Initialize with default admin user for persistent login
  await initializeTempAuth();

  // Add activity logging middleware after authentication setup
  app.use(createActivityLogger({ storage }));

  // Import and register signup routes
  const { signupRoutes } = await import("./routes/signup");
  app.use("/api", signupRoutes);

  // Import and register password reset routes
  const passwordResetRoutes = await import("./routes/password-reset");
  app.use("/api", passwordResetRoutes.default);
  
  // Register Stream Chat routes with authentication
  const { streamRoutes } = await import("./routes/stream");
  app.use("/api/stream", isAuthenticated, streamRoutes);

  // Import and use the new modular routes
  const mainRoutes = createMainRoutes({
    isAuthenticated,
    requirePermission,
    sessionStore,
    storage
  });
  app.use(mainRoutes);

  // Import and register sandwich distributions routes
  const sandwichDistributionsRoutes = await import("./routes/sandwich-distributions");
  app.use("/api/sandwich-distributions", sandwichDistributionsRoutes.default);

  // Import and register recipients routes
  const recipientsRoutes = await import("./routes/recipients");
  app.use("/api/recipients", recipientsRoutes.default);

  // Add missing drivers and volunteers endpoints that were lost during refactoring
  app.get("/api/drivers", isAuthenticated, async (req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      console.error("Failed to get drivers", error);
      res.status(500).json({ message: "Failed to get drivers" });
    }
  });

  app.get("/api/volunteers", isAuthenticated, async (req, res) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      res.json(volunteers);
    } catch (error) {
      console.error("Failed to get volunteers", error);
      res.status(500).json({ message: "Failed to get volunteers" });
    }
  });

  // Add missing hosts endpoints that were lost during refactoring
  const hostsRoutes = await import("./routes/hosts");
  app.use("/api", hostsRoutes.default);

  // Import and register recipient TSP contacts routes
  const recipientTspContactRoutes = await import("./routes/recipient-tsp-contacts");
  app.use("/api/recipient-tsp-contacts", recipientTspContactRoutes.default);

  // Register event request routes
  const eventRequestRoutes = await import("./routes/event-requests");
  app.use("/api/event-requests", eventRequestRoutes.default);
  
  // Register event reminders routes  
  const activityLogger = (req: any, action: string, description: string, metadata?: any) => {
    // Simple activity logging for event reminders - using logger middleware instead of console
  };
  app.use("/api/event-reminders", createEventRemindersRoutes(isAuthenticated, activityLogger));
  
  // Register import events routes
  const importEventsRoutes = await import("./routes/import-events");
  app.use("/api/import", importEventsRoutes.default);
  
  // User routes are now handled by the modular system in server/routes/index.ts

  // Register performance optimization routes
  const { registerPerformanceRoutes } = await import("./routes/performance");
  registerPerformanceRoutes(app);

  // Create HTTP server
  const server = createServer(app);

  return server;
}