// Firebase web app configuration. These values are identifiers, not private server secrets.
// Copy the web-app config from Firebase Console > Project settings > Your apps.
export const firebaseConfig = {
  apiKey: "AIzaSyCEAwOohrv7_-BvMdBa0FZ6hX4ZZoYceok",
  authDomain: "maru-ghar-gandhinagar-8dbe4.firebaseapp.com",
  projectId: "maru-ghar-gandhinagar-8dbe4",
  storageBucket: "maru-ghar-gandhinagar-8dbe4.firebasestorage.app",
  messagingSenderId: "301612847347",
  appId: "1:301612847347:web:2eb36de8d6495260fde786"
};

// Cloudinary Console > Settings > Product environment credentials: Cloud name.
// Unsigned upload preset must be exactly: marughar_images
export const cloudinaryConfig = {
  cloudName: "t5gd6nts",
  uploadPreset: "marughar_images",
  // Video upload uses the same unsigned preset unless you create a separate one (e.g. "marughar_videos").
  videoUploadPreset: "marughar_images"
};

export const isFirebaseConfigured = () =>
  !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE_") &&
  !!firebaseConfig.appId && !firebaseConfig.appId.startsWith("PASTE_") &&
  !!firebaseConfig.messagingSenderId && !firebaseConfig.messagingSenderId.startsWith("PASTE_") &&
  !!firebaseConfig.storageBucket && !firebaseConfig.storageBucket.startsWith("PASTE_");
export const isCloudinaryConfigured = () =>
  !!cloudinaryConfig.cloudName && !cloudinaryConfig.cloudName.startsWith("PASTE_") &&
  !!cloudinaryConfig.uploadPreset;
