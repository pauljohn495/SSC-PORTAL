import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://2301102187_db_user:V04dFoI1ZvOcjsdX@buksu.pdd0zsh.mongodb.net/buksu?retryWrites=true&w=majority&appName=BUKSU')
.then (() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true, unique: true }, // Allow null for manual admins, but unique when present
  name: String,
  email: { type: String, unique: true }, // Make email unique
  picture: String,
  username: { type: String, unique: true, sparse: true }, // For manual admin login, unique when present
  password: String, // For manual admin login
  role: { type: String, default: 'student' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Handbook schema
const handbookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Handbook = mongoose.model('Handbook', handbookSchema);

// Memorandum schema (updated with status)
const memorandumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  year: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const Memorandum = mongoose.model('Memorandum', memorandumSchema);

export { User, Handbook, Memorandum };
