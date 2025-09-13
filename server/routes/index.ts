import { Router } from "express";
import createAdminRoutes from "./admin";
import createAuthRoutes from "./auth";
import createGroupsCatalogRoutes from "./groups-catalog";

// Import organized feature routers
import usersRouter from "./users";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import collectionsRouter from "./collections";
import meetingsRouter from "./meetings";
import messagingRouter from "./messaging";
import notificationsRouter from "./notifications";
import reportsRouter from "./reports";
import searchRouter from "./search";
import storageRouter from "./storage";
import versioningRouter from "./versioning";
import coreRouter from "./core";

// Import centralized middleware
import { createStandardMiddleware, createErrorHandler } from "../middleware";

interface RouterDependencies {
  isAuthenticated: any;
  requirePermission: any;
  sessionStore: any;
}

export function createMainRoutes(deps: RouterDependencies) {
  const router = Router();

  // Legacy routes - preserve existing functionality
  const adminRoutes = createAdminRoutes({
    isAuthenticated: deps.isAuthenticated,
    requirePermission: deps.requirePermission,
    sessionStore: deps.sessionStore
  });
  router.use("/api", adminRoutes);

  const authRoutes = createAuthRoutes({
    isAuthenticated: deps.isAuthenticated
  });
  router.use("/api/auth", authRoutes);

  const groupsCatalogRoutes = createGroupsCatalogRoutes({
    isAuthenticated: deps.isAuthenticated
  });
  router.use("/api/groups-catalog", groupsCatalogRoutes);

  // New organized feature routes with consistent middleware
  // Core application routes (health checks, session management)
  router.use("/api", coreRouter);

  // Feature-based routes with standardized middleware
  router.use("/api/users", deps.isAuthenticated, ...createStandardMiddleware(), usersRouter);
  router.use("/api/users", createErrorHandler("users"));

  router.use("/api/projects", deps.isAuthenticated, ...createStandardMiddleware(), projectsRouter);
  router.use("/api/projects", createErrorHandler("projects"));

  router.use("/api/tasks", deps.isAuthenticated, ...createStandardMiddleware(), tasksRouter);
  router.use("/api/tasks", createErrorHandler("tasks"));

  router.use("/api/collections", deps.isAuthenticated, ...createStandardMiddleware(), collectionsRouter);
  router.use("/api/collections", createErrorHandler("collections"));

  router.use("/api/meetings", deps.isAuthenticated, ...createStandardMiddleware(), meetingsRouter);
  router.use("/api/meetings", createErrorHandler("meetings"));

  router.use("/api/messaging", deps.isAuthenticated, ...createStandardMiddleware(), messagingRouter);
  router.use("/api/messaging", createErrorHandler("messaging"));

  router.use("/api/notifications", deps.isAuthenticated, ...createStandardMiddleware(), notificationsRouter);
  router.use("/api/notifications", createErrorHandler("notifications"));

  router.use("/api/reports", deps.isAuthenticated, ...createStandardMiddleware(), reportsRouter);
  router.use("/api/reports", createErrorHandler("reports"));

  router.use("/api/search", deps.isAuthenticated, ...createStandardMiddleware(), searchRouter);
  router.use("/api/search", createErrorHandler("search"));

  router.use("/api/storage", deps.isAuthenticated, ...createStandardMiddleware(), storageRouter);
  router.use("/api/storage", createErrorHandler("storage"));

  router.use("/api/versioning", deps.isAuthenticated, ...createStandardMiddleware(), versioningRouter);
  router.use("/api/versioning", createErrorHandler("versioning"));

  return router;
}

// Backwards compatibility exports
export { createMainRoutes as apiRoutes };
export default createMainRoutes;