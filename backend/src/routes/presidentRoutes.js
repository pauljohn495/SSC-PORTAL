import express from 'express';
import { getAuthUrl, oauthCallback, listEvents, createEvent, updateEvent, archiveEvent, getArchivedEvents, restoreEvent, deleteEvent } from '../controllers/calendarController.js';
import {
  createHandbook,
  updateHandbook,
  getHandbookSections,
  createHandbookSection,
  updateHandbookSection,
  getNotifications,
  createNotification,
  publishNotification,
  deleteNotification,
  uploadMemorandum,
  updateMemorandum,
  getDriveAuthUrl,
  driveOAuthCallback,
  getDriveConnectionStatus
} from '../controllers/presidentController.js';
import { getActivityLogs } from '../controllers/adminController.js';
import {
  getPresidentPolicyDepartments,
  createPolicyDepartment,
  updatePolicyDepartment,
  createPolicySection,
  updatePolicySection,
  deletePolicySection
} from '../controllers/policyController.js';

const router = express.Router();

// Calendar routes
router.get('/calendar/auth-url', getAuthUrl);
router.get('/calendar/oauth/callback', oauthCallback);
router.get('/calendar/events', listEvents);
router.post('/calendar/events', createEvent);
router.put('/calendar/events/:eventId', updateEvent);
router.put('/calendar/events/:eventId/archive', archiveEvent);
router.get('/calendar/events/archived', getArchivedEvents);
router.put('/calendar/events/:eventId/restore', restoreEvent);
router.delete('/calendar/events/:eventId', deleteEvent);

// Google Drive OAuth routes
router.get('/drive/auth-url', getDriveAuthUrl);
router.get('/drive/oauth/callback', driveOAuthCallback);
router.get('/drive/status', getDriveConnectionStatus);

// Handbook routes
router.post('/handbook', createHandbook);
router.put('/handbook/:id', updateHandbook);
router.get('/handbook-sections', getHandbookSections);
router.post('/handbook-sections', createHandbookSection);
router.put('/handbook-sections/:id', updateHandbookSection);

// Notifications routes
router.get('/notifications', getNotifications);
router.post('/notifications', createNotification);
router.post('/notifications/:id/publish', publishNotification);
router.delete('/notifications/:id', deleteNotification);

// Memorandum routes
router.post('/memorandums', uploadMemorandum);
router.put('/memorandums/:id', updateMemorandum);

// Activity logs routes
router.get('/activity-logs', getActivityLogs);

// Policy management routes
router.get('/policies/departments', getPresidentPolicyDepartments);
router.post('/policies/departments', createPolicyDepartment);
router.put('/policies/departments/:id', updatePolicyDepartment);
router.post('/policies/sections', createPolicySection);
router.put('/policies/sections/:id', updatePolicySection);
router.delete('/policies/sections/:id', deletePolicySection);

export default router;
