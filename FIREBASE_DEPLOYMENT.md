# Firebase Deployment Guide

This guide will help you deploy your Sandwich Project application to Firebase outside of Replit.

## Prerequisites

- Firebase account (https://firebase.google.com)
- Node.js 20+ installed locally
- Firebase CLI installed (`npm install -g firebase-tools`)
- PostgreSQL database (Neon, Supabase, or Google Cloud SQL)
- Google Cloud Storage bucket for file uploads

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Enter project name (e.g., "sandwich-project-app")
4. Enable Google Analytics (optional)
5. Create the project

## Step 2: Enable Firebase Services

### Enable Firebase App Hosting

1. In Firebase Console, go to "Build" → "App Hosting"
2. Click "Get Started"
3. Follow the setup wizard

### Enable Firebase Hosting (Optional)

If you want to use Firebase Hosting for static assets:

1. Go to "Build" → "Hosting"
2. Click "Get Started"
3. Follow the setup instructions

## Step 3: Set Up Google Cloud Services

### Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project
3. Navigate to "IAM & Admin" → "Service Accounts"
4. Click "Create Service Account"
5. Name: `firebase-app-service-account`
6. Grant these roles:
   - Cloud Storage Admin (for file uploads)
   - Cloud SQL Client (if using Cloud SQL)
7. Click "Create Key" → Choose JSON
8. Download and save the key file securely

### Create Google Cloud Storage Bucket

1. Go to "Cloud Storage" → "Buckets"
2. Click "Create Bucket"
3. Name: `your-project-id-uploads` (choose a unique name)
4. Location: Choose region close to your users
5. Storage class: Standard
6. Access control: Uniform
7. Create the bucket

### Create Folder Structure

Create these folders in your bucket:
- `/public` - for public assets
- `/private/uploads` - for user uploads

## Step 4: Set Up PostgreSQL Database

Choose one of these options:

### Option A: Neon (Recommended - Already configured)

1. Go to [Neon](https://neon.tech)
2. Create account and new project
3. Copy the connection string

### Option B: Supabase

1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Go to Settings → Database
4. Copy the connection string

### Option C: Google Cloud SQL

1. In Google Cloud Console, go to "SQL"
2. Create PostgreSQL instance
3. Create database
4. Set up connection (use Cloud SQL Proxy or public IP with SSL)

## Step 5: Configure Environment Variables in Firebase

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init`
   - Select "App Hosting"
   - Choose your Firebase project
   - Accept defaults for build settings

4. Set environment variables:

```bash
# Required - Application
firebase apphosting:secrets:set NODE_ENV
# Enter: production

firebase apphosting:secrets:set APP_URL
# Enter: https://your-app.web.app (or your custom domain)

firebase apphosting:secrets:set SESSION_SECRET
# Enter: Generate a long random string (use: openssl rand -base64 32)

# Required - Database
firebase apphosting:secrets:set DATABASE_URL
# Enter: Your PostgreSQL connection string

firebase apphosting:secrets:set PRODUCTION_DATABASE_URL
# Enter: Same as DATABASE_URL

# Required - Google Cloud
firebase apphosting:secrets:set GOOGLE_PROJECT_ID
# Enter: your-firebase-project-id

firebase apphosting:secrets:set GOOGLE_SERVICE_ACCOUNT_EMAIL
# Enter: your-service-account@your-project.iam.gserviceaccount.com

firebase apphosting:secrets:set GOOGLE_PRIVATE_KEY
# Enter: Copy the private_key from your service account JSON file
# Important: Keep the \n characters as literal \n (not newlines)

# Required - Google Cloud Storage
firebase apphosting:secrets:set PRIVATE_OBJECT_DIR
# Enter: /your-bucket-name/private

firebase apphosting:secrets:set PUBLIC_OBJECT_SEARCH_PATHS
# Enter: /your-bucket-name/public

firebase apphosting:secrets:set GCS_BUCKET_NAME
# Enter: your-bucket-name

# Optional - SendGrid Email
firebase apphosting:secrets:set SENDGRID_API_KEY
# Enter: Your SendGrid API key

firebase apphosting:secrets:set SENDGRID_FROM_EMAIL
# Enter: noreply@yourdomain.com

# Optional - Twilio SMS
firebase apphosting:secrets:set TWILIO_ACCOUNT_SID
# Enter: Your Twilio Account SID

firebase apphosting:secrets:set TWILIO_AUTH_TOKEN
# Enter: Your Twilio Auth Token

firebase apphosting:secrets:set TWILIO_PHONE_NUMBER
# Enter: Your Twilio phone number

# Optional - Google Sheets Integration
firebase apphosting:secrets:set GOOGLE_SPREADSHEET_ID
# Enter: Your Google Spreadsheet ID

firebase apphosting:secrets:set EVENT_REQUESTS_SHEET_ID
# Enter: Your Event Requests Sheet ID

firebase apphosting:secrets:set PROJECTS_SHEET_ID
# Enter: Your Projects Sheet ID

# Optional - Stream Chat
firebase apphosting:secrets:set STREAM_API_KEY
# Enter: Your Stream API key

firebase apphosting:secrets:set STREAM_API_SECRET
# Enter: Your Stream API secret

# Optional - Sentry Error Tracking
firebase apphosting:secrets:set SENTRY_DSN
# Enter: Your Sentry DSN

# Optional - OpenAI
firebase apphosting:secrets:set OPENAI_API_KEY
# Enter: Your OpenAI API key
```

## Step 6: Configure Firebase Project Files

### Create .firebaserc

Copy `.firebaserc.example` to `.firebaserc`:

```bash
cp .firebaserc.example .firebaserc
```

Edit `.firebaserc` and replace `your-firebase-project-id` with your actual project ID.

### Verify apphosting.yaml

The `apphosting.yaml` file should look like this:

```yaml
run:
  source: .
  runtime: nodejs20
  build:
    command: ["npm", "run", "build"]
  command: ["npm", "start"]
  workingDirectory: .
```

This is already configured correctly in your project.

## Step 7: Build and Test Locally

Before deploying, test the build process:

```bash
# Install dependencies
npm install

# Run build
npm run build

# Test production build locally
NODE_ENV=production npm start
```

Visit http://localhost:5000 to verify the app works.

## Step 8: Deploy to Firebase

### Deploy Using Firebase CLI

```bash
# Deploy App Hosting (backend + frontend)
firebase deploy --only apphosting

# Or deploy everything (hosting + apphosting)
firebase deploy
```

### Deploy Using Git (Recommended)

Firebase App Hosting can automatically deploy from your Git repository:

1. In Firebase Console, go to App Hosting
2. Click "Add Backend"
3. Connect your GitHub/GitLab repository
4. Select the branch to deploy (e.g., `main`)
5. Firebase will automatically deploy on every push

## Step 9: Run Database Migrations

After first deployment, run migrations:

```bash
# SSH into your Firebase App Hosting instance or use Cloud Shell
npm run db:push
```

Or manually connect to your database and run the migrations in the `/migrations` folder.

## Step 10: Verify Deployment

1. Check Firebase Console for deployment status
2. Visit your app URL: `https://your-project-id.web.app`
3. Test key features:
   - User authentication
   - Database operations
   - File uploads
   - Email notifications (if configured)
   - Real-time features (WebSocket)

## Step 11: Set Up Custom Domain (Optional)

1. In Firebase Console, go to "Hosting"
2. Click "Add custom domain"
3. Enter your domain name
4. Follow DNS configuration instructions
5. Wait for SSL certificate to be provisioned (can take up to 24 hours)

## Troubleshooting

### Build Fails

- Check Node.js version: Should be 20+
- Run `npm install` to ensure all dependencies are installed
- Check build logs in Firebase Console

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check if database allows connections from Firebase IP addresses
- For Cloud SQL: Ensure Cloud SQL Proxy is configured or public IP is enabled

### File Upload Issues

- Verify Google Cloud Storage bucket exists
- Check service account has "Storage Admin" role
- Verify PRIVATE_OBJECT_DIR and PUBLIC_OBJECT_SEARCH_PATHS are correct
- Test bucket permissions: Try uploading a file manually

### Environment Variables Not Working

- Use `firebase apphosting:secrets:list` to verify secrets are set
- Secrets must be set using Firebase CLI, not in .env file
- After updating secrets, redeploy the app

### WebSocket Connection Fails

- Ensure your Firebase plan supports WebSockets (Blaze plan required)
- Check CORS configuration in `server/config/cors.ts`
- Verify APP_URL is set correctly

### Session/Authentication Issues

- Verify SESSION_SECRET is set
- Check that NODE_ENV is set to 'production'
- Ensure cookies are being sent (check browser console)
- For custom domains: Update APP_URL to your custom domain

## Monitoring and Logs

### View Logs

```bash
# View real-time logs
firebase apphosting:logs --tail

# View logs in Firebase Console
# Go to App Hosting → Your app → Logs
```

### Set Up Monitoring

1. Enable Google Cloud Monitoring
2. Set up Sentry for error tracking (optional)
3. Use Firebase Performance Monitoring (optional)

## Cost Considerations

- **Firebase App Hosting**: Blaze plan required (~$25/month minimum)
- **Cloud Storage**: Pay per GB stored + bandwidth
- **PostgreSQL**: Varies by provider (Neon free tier available)
- **SendGrid**: Free tier: 100 emails/day
- **Twilio**: Pay per SMS sent

## Security Checklist

- ✅ All environment variables set as Firebase secrets (not in code)
- ✅ Database connection uses SSL
- ✅ Service account JSON key not committed to git
- ✅ CORS configured correctly
- ✅ SESSION_SECRET is strong and random
- ✅ HTTPS enabled (automatic with Firebase)
- ✅ Security headers configured in firebase.json

## Additional Resources

- [Firebase App Hosting Documentation](https://firebase.google.com/docs/app-hosting)
- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Neon Documentation](https://neon.tech/docs)

## Support

For issues specific to this application, please refer to:
- `DEPLOYMENT.md` - General deployment guide
- `TROUBLESHOOTING.md` - Common issues and solutions
- `ARCHITECTURE.md` - System architecture details

## Migration from Replit

If you're migrating from Replit:

1. ✅ All REPL_* environment variables have been replaced with generic alternatives
2. ✅ Object storage updated to use standard Google Cloud Storage
3. ✅ Session configuration updated for Firebase
4. ✅ Build process compatible with Firebase

Key changes made:
- `REPL_URL` → `APP_URL`
- `REPL_ID` checks removed (use `NODE_ENV` instead)
- Replit Object Storage → Google Cloud Storage
- Replit Database → PostgreSQL (Neon/Supabase/Cloud SQL)
