import { google } from 'googleapis'
import User from '../models/User.js'
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
  }
  
  // Create simplified log data (without full response object)
  const logData = {
    method,
    endpoint,
    status,
    message: responseData?.message || null,
    content
  };
  
  // Set custom header for browser console logging only (no server console log)
  res.setHeader('X-API-Log', JSON.stringify(logData));
  
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
    logAndSetHeader(req, res, 'GET', '/api/president/calendar/events', 200, { events: response, count: response.length })
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
    const response = calendarResponse.data
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

export const deleteEvent = async (req, res) => {
  try {
    const { userId } = req.query
    const { eventId } = req.params
    const user = await ensurePresident(userId)
    const calendar = getCalendarClient(user)
    const calendarId = config.google.calendarId || 'primary'
    await calendar.events.delete({ calendarId, eventId })
    const response = { success: true }
    logAndSetHeader(req, res, 'DELETE', `/api/president/calendar/events/${eventId}`, 200, response)
    res.json(response)
  } catch (e) {
    const status = e.message === 'User not found' ? 404 : e.message === 'Forbidden' ? 403 : 400
    const response = { message: e.message }
    logAndSetHeader(req, res, 'DELETE', `/api/president/calendar/events/${eventId}`, status, response)
    res.status(status).json(response)
  }
}


