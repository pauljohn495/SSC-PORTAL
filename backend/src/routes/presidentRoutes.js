import express from 'express';
import * as presidentController from '../controllers/presidentController.js';

const router = express.Router();

// Memorandum routes
router.post('/memorandums', presidentController.uploadMemorandum);
router.post('/memorandums/:id/priority', presidentController.setMemorandumPriority);
router.put('/memorandums/:id', presidentController.updateMemorandum);
router.post('/memorandums/:id/clear-priority', presidentController.clearMemorandumPriority);

// Handbook routes
router.post('/handbook', presidentController.createHandbook);
router.post('/handbook/:id/priority', presidentController.setHandbookPriority);
router.put('/handbook/:id', presidentController.updateHandbook);
router.post('/handbook/:id/clear-priority', presidentController.clearHandbookPriority);

// Activity logs
router.get('/activity-logs', presidentController.getUserActivityLogs);

export default router;

