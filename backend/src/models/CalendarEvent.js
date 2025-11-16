import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema({
  googleEventId: { type: String, required: true, unique: true },
  summary: String,
  description: String,
  location: String,
  start: Date,
  end: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  archived: { type: Boolean, default: false },
  archivedAt: Date
}, { timestamps: true });

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);

export default CalendarEvent;

