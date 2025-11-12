import express from 'express';
import * as authController from '../controllers/authController.js';

const router = express.Router();

router.post('/google', authController.googleAuth);
router.post('/admin', authController.adminLogin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/fcm-token', authController.registerFcmToken);
router.post('/test-email', authController.testEmail); // Development only

export default router;

