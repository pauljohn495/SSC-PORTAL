import mongoose from 'mongoose';

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://2301102187_db_user:V04dFoI1ZvOcjsdX@buksu.pdd0zsh.mongodb.net/buksu?retryWrites=true&w=majority&appName=BUKSU')
.then (() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: String,
  email: String,
  picture: String,
  role: { type: String, default: 'student' }
});

const User = mongoose.model('User', userSchema);

export { User };
