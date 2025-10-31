import express from 'express';
import authRoutes from './authRoutes.js';
import adminRoutes from './adminRoutes.js';
import presidentRoutes from './presidentRoutes.js';
import publicRoutes from './publicRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/', publicRoutes); // Public routes use root /api
router.use('/president', presidentRoutes);

export default router;

