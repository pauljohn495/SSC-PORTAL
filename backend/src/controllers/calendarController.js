import { google } from 'googleapis'
import User from '../models/User.js'
import CalendarEvent from '../models/CalendarEvent.js'
import { config } from '../config/index.js'

// Helper function to create simplified log and set response header
const logAndSetHeader = (req, res, method, endpoint, status, responseData) => {
  // Extract content from various response structures
  let content = null;
  if (responseData?.content) {
    content = responseData.content;
  } else if (responseData?.events) {
    content = responseData.events;
  } else if (responseData?.url) {
    content = responseData.url;
  } else if (Array.isArray(responseData)) {
    content = responseData;
  } else if (responseData && typeof responseData === 'object') {
    // For event objects, exclude large fields if needed
    const { htmlLink, iCalUID, ...eventWithoutLargeFields } = responseData;
    content = eventWithoutLargeFields;
  }
  
  // Create simplified log data (without content)
  const logData = {
    method,
    endpoint,
    status,
    message: responseData?.message || null
  };
  
  // Set custom header for browser console logging only (no server console log)
  // Sanitize header value to remove invalid characters (newlines, carriage returns, control chars, etc.)
  try {
    // Safely stringify, handling circular references and other edge cases
    let headerValue;
    try {
      headerValue = JSON.stringify(logData);
    } catch (stringifyError) {
      // If stringify fails, create a simplified version
      headerValue = JSON.stringify({
        method: logData.method,
        endpoint: logData.endpoint,
        status: logData.status,
        message: logData.message || 'Response data could not be serialized'
      });
    }
    
    // Remove all invalid characters for HTTP headers:
    // - Control characters (0x00-0x1F except HTAB 0x09)
    // - DEL (0x7F)
    // - Newlines, carriage returns, form feeds, etc.
    headerValue = headerValue.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
    
    // Replace tabs, newlines, and carriage returns with spaces
    headerValue = headerValue.replace(/[\r\n\t]/g, ' ');
    
    // Replace multiple spaces with single space
    headerValue = headerValue.replace(/\s+/g, ' ');
    
    // Trim the value
    headerValue = headerValue.trim();
    
    if (headerValue.length > 8000) {
      // If too large, simplify further (shouldn't happen without content, but just in case)
      const simplifiedLogData = {
        method: logData.method,
        endpoint: logData.endpoint,
        status: logData.status,
        message: logData.message || null
      };
      headerValue = JSON.stringify(simplifiedLogData)
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Only set header if value is valid and not empty
    if (headerValue && headerValue.length > 0) {
      res.setHeader('X-API-Log', headerValue);
    }
  } catch (error) {
    // If header setting fails, just skip it (don't break the response)
    console.error('Failed to set X-API-Log header:', error);
  }
  
  return logData;
};

const getOAuth2Client = (tokens) => {
  const oAuth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  )
  if (tokens) {
    oAuth2Client.setCredentials(tokens)
  }
  return oAuth2Client
}

const ensurePresident = async (userId) => {
  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')
  if (user.role !== 'president') throw new Error('Forbidden')
  return user
}

export const getAuthUrl = async (req, res) => {
  try {
    const { userId } = req.query
    await ensurePresident(userId)

    const oAuth2Client = getOAuth2Client()
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events'
    ]
    const state = encodeURIComponent(JSON.stringify({ userId }))
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state
    })
    const response = { url: authUrl }
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/auth-url', 200, response)
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/auth-url', status, response)
    res.status(status).json(response)
  }
}

export const oauthCallback = async (req, res) => {
  try {
    const { code, state } = req.query
    const { userId } = JSON.parse(decodeURIComponent(state || '{}'))
    const user = await ensurePresident(userId)

    const oAuth2Client = getOAuth2Client()
    const { tokens } = await oAuth2Client.getToken(code)

    user.googleCalendar = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || user.googleCalendar?.refreshToken,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiryDate: tokens.expiry_date
    }
    await user.save()

    const response = { message: 'Google Calendar connected. You can close this window.' }
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/oauth/callback', 200, response)
    res.send(response.message)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: `OAuth error: ${e.message}` }
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/oauth/callback', status, response)
    res.status(status).send(response.message)
  }
}

const getCalendarClient = (user) => {
  const tokens = {
    access_token: user.googleCalendar?.accessToken,
    refresh_token: user.googleCalendar?.refreshToken,
    scope: user.googleCalendar?.scope,
    token_type: user.googleCalendar?.tokenType,
    expiry_date: user.googleCalendar?.expiryDate
  }
  const auth = getOAuth2Client(tokens)
  return google.calendar({ version: 'v3', auth })
}

export const listEvents = async (req, res) => {
  try {
    const { userId, maxResults = 20 } = req.query
    const user = await ensurePresident(userId)
    if (!user.googleCalendar?.refreshToken && !user.googleCalendar?.accessToken) {
      const response = { message: 'Calendar not connected' }
      logAndSetHeader(req, res, 'GET', '/api/president/calendar/events', 409, response)
      return res.status(409).json(response)
    }
    const calendar = getCalendarClient(user)
    const calendarId = config.google.calendarId || 'primary'
    const now = new Date().toISOString()
    const calendarResponse = await calendar.events.list({
      calendarId,
      timeMin: now,
      maxResults: Number(maxResults),
      singleEvents: true,
      orderBy: 'startTime'
    })
    const events = calendarResponse.data.items || []
    const response = events
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/events', 200, { 
      message: `Fetched ${events.length} calendar event${events.length !== 1 ? 's' : ''}`,
      events: response, 
      count: response.length 
    })
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/events', status, response)
    res.status(status).json(response)
  }
}

export const createEvent = async (req, res) => {
  try {
    const { userId, summary, description, startISO, endISO, location, timeZone } = req.body
    const user = await ensurePresident(userId)
    const calendar = getCalendarClient(user)
    const calendarId = config.google.calendarId || 'primary'
    
    // Use provided timezone or default to UTC
    const eventTimeZone = timeZone || 'UTC'
    
    const event = {
      summary,
      description,
      location,
      start: { 
        dateTime: startISO,
        timeZone: eventTimeZone
      },
      end: { 
        dateTime: endISO,
        timeZone: eventTimeZone
      }
    }
    const calendarResponse = await calendar.events.insert({ calendarId, requestBody: event })
    
    // Store event in database for archiving purposes
    try {
      await CalendarEvent.create({
        googleEventId: calendarResponse.data.id,
        summary: calendarResponse.data.summary,
        description: calendarResponse.data.description,
        location: calendarResponse.data.location,
        start: calendarResponse.data.start?.dateTime ? new Date(calendarResponse.data.start.dateTime) : null,
        end: calendarResponse.data.end?.dateTime ? new Date(calendarResponse.data.end.dateTime) : null,
        createdBy: user._id
      })
    } catch (dbError) {
      // Log error but don't fail the request if DB save fails
      console.error('Error saving event to database:', dbError)
    }
    
    const response = { 
      ...calendarResponse.data,
      message: 'Calendar event created successfully'
    }
    logAndSetHeader(req, res, 'POST', '/api/president/calendar/events', 200, response)
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'POST', '/api/president/calendar/events', status, response)
    res.status(status).json(response)
  }
}

export const updateEvent = async (req, res) => {
  try {
    const { userId, summary, description, startISO, endISO, location } = req.body
    const { eventId } = req.params
    const user = await ensurePresident(userId)
    const calendar = getCalendarClient(user)
    const calendarId = config.google.calendarId || 'primary'
    const event = {
      summary,
      description,
      location,
      start: startISO ? { dateTime: startISO } : undefined,
      end: endISO ? { dateTime: endISO } : undefined
    }
    const calendarResponse = await calendar.events.patch({ calendarId, eventId, requestBody: event })
    const response = calendarResponse.data
    logAndSetHeader(req, res, 'PUT', `/api/president/calendar/events/${eventId}`, 200, response)
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'PUT', `/api/president/calendar/events/${eventId}`, status, response)
    res.status(status).json(response)
  }
}

export const archiveEvent = async (req, res) => {
  try {
    const { userId } = req.query
    const { eventId } = req.params
    const user = await ensurePresident(userId)
    const calendar = getCalendarClient(user)
    const calendarId = config.google.calendarId || 'primary'

    // Get event details before archiving
    let eventDetails = null
    try {
      const eventResponse = await calendar.events.get({ calendarId, eventId })
      eventDetails = eventResponse.data
    } catch (e) {
      // Event might not exist in Google Calendar, but we'll still try to archive in DB
    }

    // Archive event in Google Calendar (delete it)
    try {
      await calendar.events.delete({ calendarId, eventId })
    } catch (e) {
      // If deletion fails, continue to archive in DB anyway
      console.error('Error deleting event from Google Calendar:', e.message)
    }

    // Archive event in database
    const calendarEvent = await CalendarEvent.findOne({ googleEventId: eventId })
    if (calendarEvent) {
      calendarEvent.archived = true
      calendarEvent.archivedAt = new Date()
      calendarEvent.deleted = false // Ensure it's not marked as deleted
      await calendarEvent.save()
    } else {
      // Create archived record if it doesn't exist
      // Use eventDetails if available, otherwise create minimal record
      try {
        await CalendarEvent.create({
          googleEventId: eventId,
          summary: eventDetails?.summary || 'Archived Event',
          description: eventDetails?.description || '',
          location: eventDetails?.location || '',
          start: eventDetails?.start?.dateTime ? new Date(eventDetails.start.dateTime) : null,
          end: eventDetails?.end?.dateTime ? new Date(eventDetails.end.dateTime) : null,
          createdBy: user._id,
          archived: true,
          archivedAt: new Date(),
          deleted: false
        })
      } catch (createError) {
        // If creation fails (e.g., duplicate key), try to update existing record
        const existingEvent = await CalendarEvent.findOne({ googleEventId: eventId })
        if (existingEvent) {
          existingEvent.archived = true
          existingEvent.archivedAt = new Date()
          existingEvent.deleted = false
          if (eventDetails) {
            existingEvent.summary = eventDetails.summary || existingEvent.summary
            existingEvent.description = eventDetails.description || existingEvent.description
            existingEvent.location = eventDetails.location || existingEvent.location
            if (eventDetails.start?.dateTime) existingEvent.start = new Date(eventDetails.start.dateTime)
            if (eventDetails.end?.dateTime) existingEvent.end = new Date(eventDetails.end.dateTime)
          }
          await existingEvent.save()
        } else {
          throw createError
        }
      }
    }

    const response = { success: true, message: 'Event archived successfully' }
    logAndSetHeader(req, res, 'PUT', `/api/president/calendar/events/${eventId}/archive`, 200, response)
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'PUT', `/api/president/calendar/events/${eventId}/archive`, status, response)
    res.status(status).json(response)
  }
}

export const getArchivedEvents = async (req, res) => {
  try {
    const { userId } = req.query
    const user = await ensurePresident(userId)

    const archivedEvents = await CalendarEvent.find({
      createdBy: user._id,
      archived: true,
      deleted: false
    }).sort({ archivedAt: -1 })

    const response = archivedEvents
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/events/archived', 200, {
      message: `Fetched ${archivedEvents.length} archived event${archivedEvents.length !== 1 ? 's' : ''}`,
      events: response,
      count: response.length
    })
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/events/archived', status, response)
    res.status(status).json(response)
  }
}

export const restoreEvent = async (req, res) => {
  try {
    const { userId } = req.query
    const { eventId } = req.params
    const user = await ensurePresident(userId)
    const calendar = getCalendarClient(user)
    const calendarId = config.google.calendarId || 'primary'

    const calendarEvent = await CalendarEvent.findOne({ googleEventId: eventId, createdBy: user._id, archived: true, deleted: false })
    if (!calendarEvent) {
      const response = { message: 'Archived event not found' }
      logAndSetHeader(req, res, 'PUT', `/api/president/calendar/events/${eventId}/restore`, 404, response)
      return res.status(404).json(response)
    }

    // Recreate event in Google Calendar
    const event = {
      summary: calendarEvent.summary,
      description: calendarEvent.description,
      location: calendarEvent.location,
      start: calendarEvent.start ? { dateTime: calendarEvent.start.toISOString() } : undefined,
      end: calendarEvent.end ? { dateTime: calendarEvent.end.toISOString() } : undefined
    }

    const calendarResponse = await calendar.events.insert({ calendarId, requestBody: event })

    // Update database: set archived to false, update googleEventId if it changed
    calendarEvent.archived = false
    calendarEvent.archivedAt = undefined
    calendarEvent.googleEventId = calendarResponse.data.id // Update to new ID
    await calendarEvent.save()

    const response = {
      ...calendarResponse.data,
      message: 'Event restored successfully'
    }
    logAndSetHeader(req, res, 'PUT', `/api/president/calendar/events/${eventId}/restore`, 200, response)
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'PUT', `/api/president/calendar/events/${eventId}/restore`, status, response)
    res.status(status).json(response)
  }
}

export const deleteEvent = async (req, res) => {
  try {
    const { userId } = req.query
    const { eventId } = req.params
    const user = await ensurePresident(userId)

    const calendarEvent = await CalendarEvent.findOne({ googleEventId: eventId, createdBy: user._id, archived: true, deleted: false })
    if (!calendarEvent) {
      const response = { message: 'Archived event not found' }
      logAndSetHeader(req, res, 'DELETE', `/api/president/calendar/events/${eventId}`, 404, response)
      return res.status(404).json(response)
    }

    // Permanently delete: set deleted to true
    calendarEvent.deleted = true
    calendarEvent.deletedAt = new Date()
    await calendarEvent.save()

    const response = { success: true, message: 'Event permanently deleted' }
    logAndSetHeader(req, res, 'DELETE', `/api/president/calendar/events/${eventId}`, 200, response)
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'DELETE', `/api/president/calendar/events/${eventId}`, status, response)
    res.status(status).json(response)
  }
}


