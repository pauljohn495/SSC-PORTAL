# API Modules Documentation

All API endpoints are prefixed with `/api` base path.

## 1. Authentication Module (`/api/auth`)

### Endpoints:
- `POST /api/auth/google` - Google OAuth authentication
- `POST /api/auth/admin` - Admin login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/fcm-token` - Register FCM token for push notifications

---

## 2. Public Module (`/api`)

### Endpoints:
- `GET /api/handbook` - Get all approved handbooks (public)
- `GET /api/memorandums` - Get all approved memorandums (public)
- `GET /api/notifications` - Get all published notifications (public)
- `POST /api/notifications/test-push` - Send test push notification
- `GET /api/search` - Search handbooks and memorandums

---

## 3. Admin Module (`/api/admin`)

### User Management:
- `GET /api/admin/users` - Get all users
- `POST /api/admin/add-admin` - Add new admin user
- `POST /api/admin/add-president` - Add new president user
- `DELETE /api/admin/users/:id` - Delete user

### Handbook Management:
- `GET /api/admin/handbook` - Get all handbooks (with status)
- `PUT /api/admin/handbook/:id` - Update handbook status (approve/reject)
- `DELETE /api/admin/handbook/:id` - Delete handbook

### Memorandum Management:
- `GET /api/admin/memorandums` - Get all memorandums (with status)
- `PUT /api/admin/memorandums/:id` - Update memorandum status (approve/reject)
- `DELETE /api/admin/memorandums/:id` - Delete memorandum

### Activity Logs:
- `GET /api/admin/activity-logs` - Get all activity logs

---

## 4. President Module (`/api/president`)

### Memorandum Management:
- `POST /api/president/memorandums` - Upload/create memorandum
- `PUT /api/president/memorandums/:id` - Update memorandum
- `POST /api/president/memorandums/:id/priority` - Set memorandum priority editing
- `POST /api/president/memorandums/:id/clear-priority` - Clear memorandum priority

### Handbook Management:
- `POST /api/president/handbook` - Create handbook page
- `PUT /api/president/handbook/:id` - Update handbook page
- `POST /api/president/handbook/:id/priority` - Set handbook priority editing
- `POST /api/president/handbook/:id/clear-priority` - Clear handbook priority

### Activity Logs:
- `GET /api/president/activity-logs` - Get user's activity logs

### Notification Management:
- `GET /api/president/notifications` - Get all notifications
- `POST /api/president/notifications` - Create notification
- `POST /api/president/notifications/:id/publish` - Publish notification
- `DELETE /api/president/notifications/:id` - Delete notification

### Google Calendar Integration:
- `GET /api/president/calendar/auth-url` - Get Google Calendar OAuth URL
- `GET /api/president/calendar/oauth/callback` - OAuth callback handler
- `GET /api/president/calendar/events` - List calendar events
- `POST /api/president/calendar/events` - Create calendar event
- `PUT /api/president/calendar/events/:eventId` - Update calendar event
- `DELETE /api/president/calendar/events/:eventId` - Delete calendar event

---

## 5. System Module

### Health Check:
- `GET /api/health` - Server health check endpoint

---

## Additional Features

### Real-time Communication:
- WebSocket support via Socket.IO (configured in `src/realtime/socket.js`)

### Search Service:
- Algolia integration for full-text search
- Database fallback search when Algolia is unavailable

### Push Notifications:
- Firebase Cloud Messaging (FCM) integration
- Push notification support for all users

### Activity Logging:
- Comprehensive activity logging system
- Tracks user actions across the system

### Priority Editing System:
- Prevents concurrent edits on handbooks and memorandums
- Automatic cleanup of stale priority locks

---

## Models

1. **User** - User accounts (student, admin, president)
2. **Handbook** - Student handbook pages
3. **Memorandum** - School memorandums
4. **Notification** - System notifications
5. **ActivityLog** - User activity tracking

---

## External Services

1. **Algolia** - Search indexing and search service
2. **Firebase Admin SDK** - Push notifications
3. **Google OAuth** - Authentication
4. **Google Calendar API** - Calendar integration
5. **MongoDB** - Primary database
6. **Socket.IO** - Real-time communication

