import express, { Router } from "express";
import { healthController } from "../controllers/health";
// Import the router directly
import usersRouter from "./users";

const router = Router();

// Health check route
router.get("/health", healthController);

// User routes
router.use("/users", usersRouter);

export default router;