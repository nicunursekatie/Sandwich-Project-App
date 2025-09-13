import express from "express";
import type { IStorage } from "../storage";

export function createEventRemindersRoutes(isAuthenticated: any, storage: IStorage) {
  const router = express.Router();
  
  // Get event reminders count
  router.get("/count", isAuthenticated, async (req: any, res: any) => {
    try {
      // Get count of pending event reminders for the current user
      const count = await storage.getEventRemindersCount(req.user?.id);
      res.json({ count });
    } catch (error) {
      console.error("Error getting event reminders count:", error);
      res.status(500).json({ error: "Failed to get event reminders count", count: 0 });
    }
  });
  
  return router;
}

export default createEventRemindersRoutes;