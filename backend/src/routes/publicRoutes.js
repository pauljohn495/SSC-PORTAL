import express from 'express';
import * as publicController from '../controllers/publicController.js';
import * as notificationController from '../controllers/notificationController.js';

const router = express.Router();

router.get('/handbook', publicController.getPublicHandbooks);
router.get('/memorandums', publicController.getPublicMemorandums);
router.get('/notifications', notificationController.getNotifications);

export default router;

