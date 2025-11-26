import express from 'express';
import * as publicController from '../controllers/publicController.js';
import { searchContent } from '../controllers/searchController.js';
import { getStudentPolicies, streamPolicySectionFile } from '../controllers/policyController.js';

const router = express.Router();

router.get('/handbook', publicController.getPublicHandbooks);
router.get('/handbook/:handbookId/file', publicController.streamHandbookFile);
router.get('/handbook/:handbookId/download-page', publicController.downloadHandbookPage);
router.get('/handbook-sections', publicController.getPublicHandbookSections);
router.get('/handbook-sections/:sectionId/file', publicController.streamHandbookSectionFile);
router.get('/memorandums', publicController.getPublicMemorandums);
router.get('/notifications', publicController.getPublicNotifications);
router.get('/departments', publicController.getDepartmentsCatalog);
router.post('/notifications/test-push', publicController.sendTestPush);
router.get('/search', searchContent);
router.get('/policies', getStudentPolicies);
router.get('/policies/sections/:sectionId/file', streamPolicySectionFile);

export default router;

