import express, { Router } from "express";
import { healthController } from "../controllers/health";
// Import routers
import usersRouter from "./users";
import authRouter from "./auth";
import logsRouter from "./logs";
import loggerMiddleware from "../middlewares/logger";

const router = Router();

// Apply logger middleware to all routes
router.use(loggerMiddleware);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Check if the API is running properly
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                 environment:
 *                   type: string
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get("/health", healthController);

// Authentication routes
router.use("/auth", authRouter);

// User routes
router.use("/users", usersRouter);

// Logs routes
router.use("/logs", logsRouter);

export default router;