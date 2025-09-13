import { Router } from "express";
import { CoreService } from "../../services/core";
import { runWeeklyMonitoring } from "../../weekly-monitoring";

const router = Router();

/**
 * Core Routes - Health checks and system monitoring
 */

// Basic health check endpoint for deployment monitoring
router.get("/health", (req, res) => {
  try {
    const healthData = CoreService.getBasicHealth();
    res.status(200).json(healthData);
  } catch (error) {
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

// System health check with performance stats (authenticated)
router.get("/system/health", async (req, res) => {
  try {
    const healthData = CoreService.getSystemHealth();
    res.json(healthData);
  } catch (error) {
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

// Weekly monitoring endpoints
router.get("/monitoring/weekly-status", async (req, res) => {
  try {
    const submissionStatus = await CoreService.getWeeklyMonitoringStatus();
    res.json(submissionStatus);
  } catch (error) {
    console.error('Error checking weekly submissions:', error);
    res.status(500).json({ error: 'Failed to check weekly submissions' });
  }
});

router.get("/monitoring/stats", async (req, res) => {
  try {
    const stats = await CoreService.getMonitoringStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting monitoring stats:', error);
    res.status(500).json({ error: 'Failed to get monitoring stats' });
  }
});

router.post("/monitoring/check-now", async (req, res) => {
  try {
    await runWeeklyMonitoring();
    res.json({ success: true, message: 'Weekly monitoring check completed' });
  } catch (error) {
    console.error('Error running weekly monitoring:', error);
    res.status(500).json({ error: 'Failed to run weekly monitoring' });
  }
});

// Project data status check
router.get("/project-data/status", async (req, res) => {
  try {
    const status = await CoreService.getProjectDataStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting project data status:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Failed to get project data status',
      error: error.message
    });
  }
});

export default router;