import express from 'express';
import * as presidentController from '../controllers/presidentController.js';
import * as calendarController from '../controllers/calendarController.js';

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

// Notification routes
router.post('/notifications', presidentController.createNotification);
router.post('/notifications/:id/publish', presidentController.publishNotification);
router.delete('/notifications/:id', presidentController.deleteNotification);
router.get('/notifications', presidentController.getNotifications);

// Google Calendar routes (president only)
router.get('/calendar/auth-url', calendarController.getAuthUrl);
router.get('/calendar/oauth/callback', calendarController.oauthCallback);
router.get('/calendar/events', calendarController.listEvents);
router.post('/calendar/events', calendarController.createEvent);
router.put('/calendar/events/:eventId', calendarController.updateEvent);
router.delete('/calendar/events/:eventId', calendarController.deleteEvent);

export default router;

