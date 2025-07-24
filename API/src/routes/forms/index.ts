import { Router } from "express";
import formsRoutes from "./forms";

const router = Router();

router.use("/", formsRoutes);

export default router;
