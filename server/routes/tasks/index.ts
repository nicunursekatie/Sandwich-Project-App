import { Router, type Request, type Response } from "express";
import { createStandardMiddleware, createErrorHandler } from "../../middleware";
import { logger } from "../../middleware/logger";
import { insertTaskCompletionSchema } from "@shared/schema";
import type { IStorage } from "../../storage";

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

// Factory function to create task routes
export default function createTaskRoutes(options: {
  storage: IStorage;
  isAuthenticated: any;
}): Router {
  const tasksRouter = Router();
  const { storage, isAuthenticated } = options;
  
  // Apply standard middleware
  const standardMiddleware = createStandardMiddleware();
  tasksRouter.use(standardMiddleware);
  
  // Apply error handling middleware
  const errorHandler = createErrorHandler('tasks');
  
  // Helper function to get user from request
  const getUser = (req: AuthenticatedRequest) => {
    return req.user || req.session?.user;
  };

  // POST /:taskId/complete - Complete a task
  tasksRouter.post("/:taskId/complete", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = getUser(req);
      const { notes } = req.body;

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if user is assigned to this task
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const assigneeIds = task.assigneeIds || [];
      if (!assigneeIds.includes(user.id)) {
        return res
          .status(403)
          .json({ error: "You are not assigned to this task" });
      }

      // Add completion record
      const completionData = insertTaskCompletionSchema.parse({
        taskId: taskId,
        userId: user.id,
        userName: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email,
        notes: notes,
      });

      const completion = await storage.createTaskCompletion(completionData);

      // Check completion status
      const allCompletions = await storage.getTaskCompletions(taskId);
      const isFullyCompleted = allCompletions.length >= assigneeIds.length;

      // If all users completed, update task status
      if (isFullyCompleted && task.status !== "completed") {
        await storage.updateTaskStatus(taskId, "completed");
      }

      res.json({
        completion: completion,
        isFullyCompleted,
        totalCompletions: allCompletions.length,
        totalAssignees: assigneeIds.length,
      });
    } catch (error) {
      console.error("Error completing task:", error);
      logger.error("Failed to complete task", error);
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  // DELETE /:taskId/complete - Remove task completion
  tasksRouter.delete("/:taskId/complete", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Remove completion record
      const success = await storage.removeTaskCompletion(taskId, user.id);
      if (!success) {
        return res.status(404).json({ error: "Completion not found" });
      }

      // Update task status back to in_progress if it was completed
      const task = await storage.getTaskById(taskId);
      if (task?.status === "completed") {
        await storage.updateTaskStatus(taskId, "in_progress");
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing completion:", error);
      logger.error("Failed to remove task completion", error);
      res.status(500).json({ error: "Failed to remove completion" });
    }
  });

  // GET /:taskId/completions - Get task completions
  tasksRouter.get("/:taskId/completions", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const completions = await storage.getTaskCompletions(taskId);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching completions:", error);
      logger.error("Failed to fetch task completions", error);
      res.status(500).json({ error: "Failed to fetch completions" });
    }
  });

  // Apply error handling middleware
  tasksRouter.use(errorHandler);

  return tasksRouter;
}

// Standalone router creation for direct use
export function createStandaloneTaskRoutes(storage: IStorage, middleware: {
  isAuthenticated: any;
}): Router {
  return createTaskRoutes({
    storage,
    isAuthenticated: middleware.isAuthenticated
  });
}