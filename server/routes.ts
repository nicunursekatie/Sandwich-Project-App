import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage-wrapper";
import { createActivityLogger } from "./middleware/activity-logger";
import createMainRoutes from "./routes/index";
import { requirePermission } from "./middleware/auth";


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

  // === CORE MODULAR ROUTES SYSTEM ===
  // Main modular routes (handles users, projects, tasks, collections, messaging, etc.)
  const mainRoutes = createMainRoutes({
    isAuthenticated,
    requirePermission,
    sessionStore,
    storage
  });
  app.use(mainRoutes);

  // === AUTHENTICATION & USER MANAGEMENT ===
  const { signupRoutes } = await import("./routes/signup");
  app.use("/api", signupRoutes);

  const passwordResetRoutes = await import("./routes/password-reset");
  app.use("/api", passwordResetRoutes.default);

  // === ENTITY MANAGEMENT ROUTES ===  
  const driversRoutes = await import("./routes/drivers");
  app.use("/api/drivers", driversRoutes.default(isAuthenticated, storage));

  const volunteersRoutes = await import("./routes/volunteers");
  app.use("/api/volunteers", volunteersRoutes.default(isAuthenticated, storage));

  const { hostsRoutes } = await import("./routes/hosts");
  app.use("/api", hostsRoutes);

  const recipientsRoutes = await import("./routes/recipients");
  app.use("/api/recipients", recipientsRoutes.default);

  const recipientTspContactRoutes = await import("./routes/recipient-tsp-contacts");
  app.use("/api/recipient-tsp-contacts", recipientTspContactRoutes.default);

  // === EVENT & DATA MANAGEMENT ===
  const eventRequestRoutes = await import("./routes/event-requests");
  app.use("/api/event-requests", eventRequestRoutes.default);

  const eventRemindersRoutes = await import("./routes/event-reminders");
  app.use("/api/event-reminders", eventRemindersRoutes.default(isAuthenticated, storage));

  const sandwichDistributionsRoutes = await import("./routes/sandwich-distributions");
  app.use("/api/sandwich-distributions", sandwichDistributionsRoutes.default);

  const importEventsRoutes = await import("./routes/import-events");
  app.use("/api/import", importEventsRoutes.default);

  // === COMMUNICATION & EXTERNAL SERVICES ===
  const emailRoutes = await import("./routes/email-routes");
  app.use("/api/emails", emailRoutes.default);

  const { streamRoutes } = await import("./routes/stream");
  app.use("/api/stream", isAuthenticated, streamRoutes);
  
  // User routes are now handled by the modular system in server/routes/index.ts

  // Register performance optimization routes
  const { registerPerformanceRoutes } = await import("./routes/performance");
  registerPerformanceRoutes(app);

  // Create HTTP server
  const server = createServer(app);

  return server;
}