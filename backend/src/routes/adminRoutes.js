import express from 'express';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();

// User management
router.get('/users', adminController.getUsers);
router.post('/add-admin', adminController.addAdmin);
router.post('/add-president', adminController.addPresident);
router.put('/users/:id/archive', adminController.archiveUser);

// Handbook management
router.get('/handbook', adminController.getHandbooks);
router.put('/handbook/:id', adminController.updateHandbookStatus);
router.delete('/handbook/:id', adminController.deleteHandbook);

// Memorandum management
router.get('/memorandums', adminController.getMemorandums);
router.put('/memorandums/:id', adminController.updateMemorandumStatus);
router.delete('/memorandums/:id', adminController.deleteMemorandum);

// Activity logs
router.get('/activity-logs', adminController.getActivityLogs);

export default router;

