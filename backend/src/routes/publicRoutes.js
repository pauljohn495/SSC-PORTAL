import express from 'express';
import * as publicController from '../controllers/publicController.js';
import { searchContent } from '../controllers/searchController.js';

const router = express.Router();

router.get('/handbook', publicController.getPublicHandbooks);
router.get('/handbook/:handbookId/download-page', publicController.downloadHandbookPage);
router.get('/memorandums', publicController.getPublicMemorandums);
router.get('/notifications', publicController.getPublicNotifications);
router.post('/notifications/test-push', publicController.sendTestPush);
router.get('/search', searchContent);

export default router;

