import express from "express";
import type { IStorage } from "../storage";

export function createEventRemindersRoutes(isAuthenticated: any, storage: IStorage) {
  const router = express.Router();
  
  // Get all event reminders
  router.get("/", isAuthenticated, async (req: any, res: any) => {
    try {
      const reminders = await storage.getAllEventReminders(req.user?.id);
      res.json(reminders);
    } catch (error) {
      console.error("Error getting event reminders:", error);
      res.status(500).json({ error: "Failed to get event reminders" });
    }
  });

  // Get event reminders count
  router.get("/count", isAuthenticated, async (req: any, res: any) => {
    try {
      const count = await storage.getEventRemindersCount(req.user?.id);
      res.json({ count });
    } catch (error) {
      console.error("Error getting event reminders count:", error);
      res.status(500).json({ error: "Failed to get event reminders count", count: 0 });
    }
  });

  // Create new event reminder
  router.post("/", isAuthenticated, async (req: any, res: any) => {
    try {
      const reminderData = {
        ...req.body,
        userId: req.user?.id,
        createdBy: req.user?.id
      };
      const reminder = await storage.createEventReminder(reminderData);
      res.status(201).json(reminder);
    } catch (error) {
      console.error("Error creating event reminder:", error);
      res.status(500).json({ error: "Failed to create event reminder" });
    }
  });

  // Update/complete event reminder
  router.put("/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = {
        ...req.body,
        updatedBy: req.user?.id,
        updatedAt: new Date()
      };
      const reminder = await storage.updateEventReminder(id, updateData);
      if (!reminder) {
        return res.status(404).json({ error: "Event reminder not found" });
      }
      res.json(reminder);
    } catch (error) {
      console.error("Error updating event reminder:", error);
      res.status(500).json({ error: "Failed to update event reminder" });
    }
  });

  // Delete event reminder
  router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteEventReminder(id);
      if (!deleted) {
        return res.status(404).json({ error: "Event reminder not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting event reminder:", error);
      res.status(500).json({ error: "Failed to delete event reminder" });
    }
  });
  
  return router;
}

export default createEventRemindersRoutes;