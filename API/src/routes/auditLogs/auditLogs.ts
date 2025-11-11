import { Router, Request, Response } from 'express';
import auditLogsController from '../../controllers/auditLogs';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticate, (req: Request, res: Response): void => {
  auditLogsController.listAuditLogs(req, res);
});

export default router;
