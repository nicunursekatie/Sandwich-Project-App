#!/bin/bash

# Firebase Deployment Setup Script
# This script helps you set up your Firebase project for deployment

set -e

echo "🔥 Firebase Deployment Setup for Sandwich Project"
echo "=================================================="
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed."
    echo "📦 Install it with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI is installed"
echo ""

# Check if user is logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please log in to Firebase..."
    firebase login
fi

echo "✅ Logged in to Firebase"
echo ""

# Create .firebaserc if it doesn't exist
if [ ! -f .firebaserc ]; then
    echo "📝 Creating .firebaserc file..."
    if [ -f .firebaserc.example ]; then
        cp .firebaserc.example .firebaserc
        echo "⚠️  Please edit .firebaserc and set your Firebase project ID"
    else
        echo "{\"projects\":{\"default\":\"your-project-id\"}}" > .firebaserc
        echo "⚠️  Please edit .firebaserc and set your Firebase project ID"
    fi
else
    echo "✅ .firebaserc already exists"
fi

echo ""
echo "📋 Setup Checklist:"
echo "==================="
echo ""
echo "1. ✅ Create Firebase project at https://console.firebase.google.com"
echo "2. ✅ Enable Firebase App Hosting in your project"
echo "3. ✅ Create Google Cloud Storage bucket for file uploads"
echo "4. ✅ Set up PostgreSQL database (Neon, Supabase, or Cloud SQL)"
echo "5. ✅ Create service account and download JSON key"
echo "6. ⏳ Configure environment variables with Firebase CLI:"
echo ""
echo "   firebase apphosting:secrets:set NODE_ENV"
echo "   firebase apphosting:secrets:set APP_URL"
echo "   firebase apphosting:secrets:set SESSION_SECRET"
echo "   firebase apphosting:secrets:set DATABASE_URL"
echo "   firebase apphosting:secrets:set GOOGLE_PROJECT_ID"
echo "   firebase apphosting:secrets:set GOOGLE_SERVICE_ACCOUNT_EMAIL"
echo "   firebase apphosting:secrets:set GOOGLE_PRIVATE_KEY"
echo "   firebase apphosting:secrets:set PRIVATE_OBJECT_DIR"
echo "   firebase apphosting:secrets:set PUBLIC_OBJECT_SEARCH_PATHS"
echo ""
echo "   See .env.example for all available environment variables"
echo ""
echo "7. ⏳ Deploy to Firebase:"
echo ""
echo "   firebase deploy --only apphosting"
echo ""
echo "📖 For detailed instructions, see FIREBASE_DEPLOYMENT.md"
echo ""
echo "✨ Setup script complete!"
