# Music Sync App

A real-time music synchronization app built with React Native, Expo, and Firebase. Users can sync music playback between two users in real-time, with features like playlists, queue management, and synchronized controls.

## Features

- **Real-time Music Sync**: Synchronize music playback between two users
- **Firebase Integration**: Uses Firebase for authentication, real-time database, and storage
- **Playlist Management**: Create and manage playlists
- **Queue System**: Add songs to queue and manage playback order
- **Music Upload**: Upload music files to Firebase Storage
- **Synchronized Controls**: Play, pause, skip, and seek controls sync between users
- **Room-based Sync**: Join rooms to sync with specific users
- **Email Authentication**: Simple email-based registration and login

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Audio**: Expo AV for audio playback
- **State Management**: React Context API
- **Real-time Sync**: Firebase Firestore real-time listeners

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Configuration

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication with Email/Password
3. Create a Firestore database
4. Set up Firebase Storage
5. Update the Firebase configuration in `config/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Firestore Rules

Set up Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Storage Rules

Set up Firebase Storage rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /music/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Run the App

```bash
npm start
```

## Usage

### Authentication
1. Open the app and sign up with your email
2. Verify your email (if required by Firebase settings)
3. Sign in to access the music player

### Music Sync
1. **Join a Room**: Tap "Join Room" and enter a room ID
2. **Upload Music**: Go to the Library tab and upload music files
3. **Sync Playback**: Both users in the same room will have synchronized playback
4. **View Participants**: Tap the people icon to see room participants

### Features
- **Play/Pause**: Synchronized between users
- **Skip**: Skip to next song in queue
- **Seek**: Seek through the current song (syncs between users)
- **Queue**: Add songs to queue and manage playback order
- **Playlists**: Create and manage playlists
- **Volume Control**: Adjust volume locally

## Project Structure

```
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Main music player screen
│   │   └── explore.tsx        # Library and upload screen
│   ├── auth.tsx               # Authentication screen
│   └── _layout.tsx            # Root layout with auth flow
├── contexts/
│   ├── AuthContext.tsx        # Authentication context
│   └── MusicContext.tsx       # Music player context
├── config/
│   └── firebase.ts            # Firebase configuration
└── components/                # Reusable components
```

## Firebase Pay-as-you-go Pricing

This app is designed to work with Firebase's pay-as-you-go pricing model, which is cost-effective for small-scale applications:

- **Authentication**: Free tier includes 10,000 monthly active users
- **Firestore**: Free tier includes 1GB storage and 50,000 reads/day
- **Storage**: Free tier includes 5GB storage and 1GB downloads/day

For two users, this should remain well within the free tier limits.

## Development Notes

- The app uses Expo AV for audio playback
- Firebase Firestore provides real-time synchronization
- Music files are stored in Firebase Storage
- Authentication is handled by Firebase Auth
- The app supports both iOS and Android

## Troubleshooting

1. **Firebase Connection Issues**: Ensure your Firebase configuration is correct
2. **Audio Playback Issues**: Check that audio files are properly uploaded and accessible
3. **Sync Issues**: Verify that both users are in the same room
4. **Upload Issues**: Ensure Firebase Storage rules allow authenticated uploads

## Future Enhancements

- User profiles and avatars
- Music recommendations
- Social features (follow users, share playlists)
- Offline mode
- Background audio playback
- Push notifications for room invites
