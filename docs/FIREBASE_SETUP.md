# Firebase Integration

This project can use multiple Firebase products (Firestore, Realtime Database, Storage, Hosting) from the existing React/Vite client. Follow these steps to configure everything end-to-end.

## 1. Prerequisites

1. Install the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```
2. Confirm the `firebase` dependency is installed in this repo (already listed in `package.json`).
3. Copy the example environment block from `README.md` into your `.env` (or `.env.local`) and populate the values from the Firebase console:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_DATABASE_URL`

## 2. Client Bootstrapping

`client/src/lib/firebase.ts` centralizes initialization:

```ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const realtimeDb = getDatabase(app);
export const storage = getStorage(app);
```

Import these exports anywhere inside the React app to read/write Firestore, listen to the Realtime DB, or upload to Storage.

## 3. Firestore

1. In the Firebase console, enable Firestore (native mode).
2. Define collections that map to the domain entities you need (e.g., `eventRequests`, `volunteers`).
3. Set security rules. During local development you can temporarily allow read/write to everyone:
   ```js
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   Tighten the rules before deploying to production.
4. Sample usage:
   ```ts
   import { collection, addDoc } from 'firebase/firestore';
   import { firestore } from '@/lib/firebase';

   await addDoc(collection(firestore, 'eventRequests'), payload);
   ```

## 4. Realtime Database

1. Enable the Realtime Database in the Firebase console.
2. Set the database URL in `VITE_FIREBASE_DATABASE_URL`.
3. Security rules mirror Firestore but use their own syntax. Example relaxed dev rule:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
4. Sample usage:
   ```ts
   import { ref, onValue } from 'firebase/database';
   import { realtimeDb } from '@/lib/firebase';

   const unsubscribe = onValue(ref(realtimeDb, 'presence'), (snapshot) => {
     console.log(snapshot.val());
   });
   ```

## 5. Storage

1. Enable Cloud Storage in the console.
2. Use the `storage` export for uploads/downloads:
   ```ts
   import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
   import { storage } from '@/lib/firebase';

   const storageRef = ref(storage, `attachments/${file.name}`);
   await uploadBytes(storageRef, file);
   const url = await getDownloadURL(storageRef);
   ```
3. Configure Storage rules to require authenticated users or restrict file paths as needed.

## 6. Hosting (optional)

If you want Firebase Hosting to serve the built React app:

1. Initialize hosting:
   ```bash
   firebase init hosting
   ```
2. Set the public directory to `dist/public` (the Vite build output).
3. Add a build script:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```
4. If you continue running the Express backend elsewhere, configure rewrites or API proxies accordingly. (Hosting can proxy to Cloud Functions or to your existing API domain.)

## 7. Admin Access (server-side)

If the Node/Express backend needs to write to Firestore/Storage outside the client rules, install `firebase-admin` and create `server/lib/firebase-admin.ts` to initialize the Admin SDK with service-account credentials. That step is optional until you have server requirements.

## 8. Next Steps

- Decide which entities move first (e.g., event requests to Firestore).
- Map existing API routes to Firebase read/write helpers.
- Add unit tests around the new data layer.
- Harden security rules once OAuth/session integration is finalized.

With the configuration above, all Firebase products are ready for use. Import the shared helpers wherever needed and expand incrementally.***

