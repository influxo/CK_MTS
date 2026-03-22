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
 *     security:
 *       - bearerAuth: []
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

/**
 * @swagger
 * /constants/chronic-conditions:
 *   get:
 *     summary: Get all available chronic conditions / ICD-10 diagnoses
 *     description: |
 *       Returns a predefined list of chronic conditions and ICD-10 diagnoses
 *       for use in beneficiary details dropdown selection.
 *     tags: [Constants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all available chronic conditions with ICD-10 codes
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: CA_RENALIS
 *                       code:
 *                         type: string
 *                         example: C64
 *                       label:
 *                         type: string
 *                         example: Ca Renalis (Kidney Cancer)
 *                   example:
 *                     - id: CA_RENALIS
 *                       code: C64
 *                       label: Ca Renalis (Kidney Cancer)
 *                     - id: DIABETES_TIP_II
 *                       code: E11
 *                       label: Diabetes mellitus tip II
 *                     - id: HIPERTENSION_ARTERIAL
 *                       code: I10
 *                       label: Hipertension arterial
 */
router.get("/chronic-conditions", authenticate, (req: Request, res: Response): void => {
  constantsController.getChronicConditions(req, res);
});

export default router;
