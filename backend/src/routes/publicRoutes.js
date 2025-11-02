import express from 'express';
import * as publicController from '../controllers/publicController.js';

const router = express.Router();

router.get('/handbook', publicController.getPublicHandbooks);
router.get('/memorandums', publicController.getPublicMemorandums);
router.get('/notifications', publicController.getPublicNotifications);

export default router;

