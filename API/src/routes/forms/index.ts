import { Router } from "express";
import formsRoutes from "./forms";
import kpiRoutes from "./kpis";

const router = Router();

router.use("/", formsRoutes);
router.use("/", kpiRoutes);

export default router;
