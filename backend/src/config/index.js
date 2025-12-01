import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5001,
  mongodbUri: process.env.MONGODB_URI,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  email: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  recaptcha: {
    secretKey: process.env.RECAPTCHA_SECRET_KEY,
    siteKey: process.env.RECAPTCHA_SITE_KEY
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    calendarId: process.env.GOOGLE_CALENDAR_ID, // optional; defaults to primary
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID // optional; folder ID for handbook uploads
  },
  algolia: {
    appId: process.env.ALGOLIA_APP_ID,
    adminApiKey: process.env.ALGOLIA_ADMIN_API_KEY,
    searchApiKey: process.env.ALGOLIA_SEARCH_API_KEY,
    indexName: process.env.ALGOLIA_INDEX_NAME || 'buksu_content'
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  }
};

