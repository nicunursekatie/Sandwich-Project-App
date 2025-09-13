import express from "express";
import type { IStorage } from "../storage";

export function createVolunteersRoutes(isAuthenticated: any, storage: IStorage) {
  const router = express.Router();

  // Get all volunteers
  router.get("/", isAuthenticated, async (req: any, res: any) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      res.json(volunteers);
    } catch (error) {
      console.error("Failed to get volunteers", error);
      res.status(500).json({ message: "Failed to get volunteers" });
    }
  });

  return router;
}

export default createVolunteersRoutes;