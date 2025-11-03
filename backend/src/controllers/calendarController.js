import { google } from 'googleapis'
import User from '../models/User.js'
import { config } from '../config/index.js'

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
    res.json({ url: authUrl })
  } catch (e) {
    res.status(400).json({ message: e.message })
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

    res.send('Google Calendar connected. You can close this window.')
  } catch (e) {
    res.status(400).send(`OAuth error: ${e.message}`)
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
      return res.status(409).json({ message: 'Calendar not connected' })
    }
    const calendar = getCalendarClient(user)
    const calendarId = config.google.calendarId || 'primary'
    const now = new Date().toISOString()
    const response = await calendar.events.list({
      calendarId,
      timeMin: now,
      maxResults: Number(maxResults),
      singleEvents: true,
      orderBy: 'startTime'
    })
    res.json(response.data.items || [])
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
}

export const createEvent = async (req, res) => {
  try {
    const { userId, summary, description, startISO, endISO, location } = req.body
    const user = await ensurePresident(userId)
    const calendar = getCalendarClient(user)
    const calendarId = config.google.calendarId || 'primary'
    const event = {
      summary,
      description,
      location,
      start: { dateTime: startISO },
      end: { dateTime: endISO }
    }
    const response = await calendar.events.insert({ calendarId, requestBody: event })
    res.json(response.data)
  } catch (e) {
    res.status(400).json({ message: e.message })
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
    const response = await calendar.events.patch({ calendarId, eventId, requestBody: event })
    res.json(response.data)
  } catch (e) {
    res.status(400).json({ message: e.message })
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
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ message: e.message })
  }
}


