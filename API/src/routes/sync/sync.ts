import { Router, Request, Response } from 'express';
import { authenticate } from '../../middlewares/auth';
import loggerMiddleware from '../../middlewares/logger';
import syncController from '../../controllers/sync';

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * tags:
 *   name: Sync
 *   description: Offline sync APIs for full clone and deltas
 */

/**
 * @swagger
 * /sync/pull:
 *   post:
 *     summary: Pull a snapshot or delta for offline sync
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               since: { type: string, format: date-time }
 *               full: { type: boolean }
 *               entities:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Snapshot or delta payload
 */
router.post('/pull', authenticate, (req: Request, res: Response) => {
  syncController.pull(req, res);
});

/**
 * @swagger
 * /sync/push:
 *   post:
 *     summary: Push pending offline mutations
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               clientId: { type: string }
 *               lastSyncedAt: { type: string, format: date-time }
 *               changes:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Push results
 */
router.post('/push', authenticate, (req: Request, res: Response) => {
  syncController.push(req, res);
});

/**
 * @swagger
 * /sync/full:
 *   get:
 *     summary: Download a full RBAC-scoped SQLite snapshot for offline use
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SQLite file
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/full', authenticate, (req: Request, res: Response) => {
  syncController.full(req, res);
});

/**
 * @swagger
 * /sync/upload:
 *   post:
 *     summary: Upload pending offline mutations (create/update/delete)
 *     tags: [Sync]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mutations:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Upload results per mutation
 */
router.post('/upload', authenticate, (req: Request, res: Response) => {
  syncController.upload(req, res);
});

export default router;
