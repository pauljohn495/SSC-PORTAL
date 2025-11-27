import express from 'express';
import * as adminController from '../controllers/adminController.js';
import { getPolicySectionsForReview, reviewPolicySection, deletePolicySectionAdmin, restorePolicySectionAdmin, permanentlyDeletePolicySectionAdmin, getArchivedPolicySections } from '../controllers/policyController.js';

const router = express.Router();

// User management
router.get('/users', adminController.getUsers);
router.post('/add-admin', adminController.addAdmin);
router.post('/add-president', adminController.addPresident);
router.put('/users/:id/archive', adminController.archiveUser);
router.put('/users/:id/restore', adminController.restoreUser);
router.delete('/users/:id', adminController.deleteUser);

// Handbook management
router.get('/handbook', adminController.getHandbooks);
router.put('/handbook/:id', adminController.updateHandbookStatus);
router.delete('/handbook/:id', adminController.deleteHandbook);
router.put('/handbook/:id/restore', adminController.restoreHandbook);
router.delete('/handbook/:id/permanent', adminController.permanentlyDeleteHandbook);
router.get('/handbook-sections', adminController.getHandbookSectionsAdmin);
router.put('/handbook-sections/:id/status', adminController.updateHandbookSectionStatus);
router.delete('/handbook-sections/:id', adminController.deleteHandbookSectionAdmin);
router.put('/handbook-sections/:id/restore', adminController.restoreHandbookSectionAdmin);
router.delete('/handbook-sections/:id/permanent', adminController.permanentlyDeleteHandbookSectionAdmin);
router.get('/handbook-sections/archived', adminController.getArchivedHandbookSections);

// Memorandum management
router.get('/memorandums', adminController.getMemorandums);
router.put('/memorandums/:id', adminController.updateMemorandumStatus);
router.delete('/memorandums/:id', adminController.deleteMemorandum);
router.put('/memorandums/:id/restore', adminController.restoreMemorandum);
router.delete('/memorandums/:id/permanent', adminController.permanentlyDeleteMemorandum);

// Activity logs
router.get('/activity-logs', adminController.getActivityLogs);
router.get('/archived', adminController.getArchivedItems);
router.post('/backups', adminController.createManualBackup);

// Policy review
router.get('/policies/sections', getPolicySectionsForReview);
router.put('/policies/sections/:sectionId/status', reviewPolicySection);
router.delete('/policies/sections/:id', deletePolicySectionAdmin);
router.put('/policies/sections/:id/restore', restorePolicySectionAdmin);
router.delete('/policies/sections/:id/permanent', permanentlyDeletePolicySectionAdmin);
router.get('/policies/sections/archived', getArchivedPolicySections);

export default router;

