import { Router, Request, Response } from 'express';
import { authenticate } from '../../middlewares/auth';
import activitySummaryController from '../../controllers/dashboard/activitySummary';

const router = Router();

router.get('/activity-summary', authenticate, (req: Request, res: Response): void => {
  activitySummaryController.getActivitySummary(req, res);
});

export default router;
