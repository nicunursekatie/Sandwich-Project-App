import express from "express";
import type { IStorage } from "../storage";

export function createDriversRoutes(isAuthenticated: any, storage: IStorage) {
  const router = express.Router();

  // Get all drivers
  router.get("/", isAuthenticated, async (req: any, res: any) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      console.error("Failed to get drivers", error);
      res.status(500).json({ message: "Failed to get drivers" });
    }
  });

  return router;
}

export default createDriversRoutes;