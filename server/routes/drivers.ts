import express from "express";
import type { IStorage } from "../storage";
import { insertDriverSchema } from "@shared/schema";

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

  // Get driver by ID
  router.get("/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Failed to get driver", error);
      res.status(500).json({ message: "Failed to get driver" });
    }
  });

  // Create new driver
  router.post("/", isAuthenticated, async (req: any, res: any) => {
    try {
      const validatedData = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(validatedData);
      res.status(201).json(driver);
    } catch (error) {
      console.error("Failed to create driver", error);
      res.status(500).json({ message: "Failed to create driver" });
    }
  });

  // Update driver (PUT)
  router.put("/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.updateDriver(id, req.body);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Failed to update driver", error);
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  // Update driver (PATCH)
  router.patch("/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.updateDriver(id, req.body);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.json(driver);
    } catch (error) {
      console.error("Failed to update driver", error);
      res.status(500).json({ message: "Failed to update driver" });
    }
  });

  // Delete driver
  router.delete("/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteDriver(id);
      if (!deleted) {
        return res.status(404).json({ message: "Driver not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete driver", error);
      res.status(500).json({ message: "Failed to delete driver" });
    }
  });

  return router;
}

export default createDriversRoutes;