import { Router, Request, Response } from "express";
import constantsController from "../../controllers/constants/index";
import { authenticate } from "../../middlewares/auth";
import loggerMiddleware from "../../middlewares/logger";

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * /constants/cities:
 *   get:
 *     summary: Get all available cities
 *     tags: [Constants]
 *     responses:
 *       200:
 *         description: List of all available cities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: [Prishtina, Prizren, Gjilan, Ferizaj, Fushë Kosova, Mitrovicë, Gjakovë, Peja, Vushtrri, Podujeva, Rahovec, Lipjan, Suharekë, Kaçanik, Skenderaj, Obiliq, Shtime, Drenas, Viti, Klinë, Istog, Kamenicë, Graçanicë, Malishevë, Deçan, Shtërpcë, Dragash]
 */
router.get("/cities", authenticate, (req: Request, res: Response): void => {
  constantsController.getCities(req, res);
});

export default router;
