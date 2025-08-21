import express, { Router } from "express";
import { healthController } from "../controllers/health";
// Import routers
import usersRouter from "./userRoutes/users";
import authRouter from "./auth/auth";
import logsRouter from "./logs/logs";
import projectsRouter from "./projects/projects";
import subprojectsRouter from "./projects/subprojects";
import activitiesRouter from "./projects/activities";
import formsRouter from "./forms";
import beneficiariesRouter from "./beneficiaries/beneficiaries";
import loggerMiddleware from "../middlewares/logger";
import rolesRouter from "./roles/roles";
import permissionsRouter from "./permissions/permissions";

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

// Projects routes
router.use("/projects", projectsRouter);

// Subprojects routes
router.use("/subprojects", subprojectsRouter);

// Activities routes
router.use("/activities", activitiesRouter);

// Forms routes
router.use("/forms", formsRouter);

// Beneficiaries routes
router.use("/beneficiaries", beneficiariesRouter);

// Roles routes
router.use("/roles", rolesRouter);

// Permissions routes
router.use("/permissions", permissionsRouter);

export default router;
