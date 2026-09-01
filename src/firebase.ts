import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getDoc, doc, getFirestore } from "firebase/firestore";
import firebaseAppletConfig from "../firebase-applet-config.json";

// Explicit static references so Vite's static define/replacement works perfectly
const viteApiKey = typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined" ? import.meta.env.VITE_FIREBASE_API_KEY : undefined;
const viteAuthDomain = typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined" ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : undefined;
const viteProjectId = typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined" ? import.meta.env.VITE_FIREBASE_PROJECT_ID : undefined;
const viteStorageBucket = typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined" ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET : undefined;
const viteMessagingSenderId = typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined" ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID : undefined;
const viteAppId = typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined" ? import.meta.env.VITE_FIREBASE_APP_ID : undefined;
const viteMeasurementId = typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined" ? import.meta.env.VITE_FIREBASE_MEASUREMENT_ID : undefined;
const viteDatabaseId = typeof import.meta !== "undefined" && typeof import.meta.env !== "undefined" ? import.meta.env.VITE_FIREBASE_DATABASE_ID : undefined;

// Node environment fallback
const nodeApiKey = typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_API_KEY : undefined;
const nodeAuthDomain = typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_AUTH_DOMAIN : undefined;
const nodeProjectId = typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_PROJECT_ID : undefined;
const nodeStorageBucket = typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_STORAGE_BUCKET : undefined;
const nodeMessagingSenderId = typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_MESSAGING_SENDER_ID : undefined;
const nodeAppId = typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_APP_ID : undefined;
const nodeMeasurementId = typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_MEASUREMENT_ID : undefined;
const nodeDatabaseId = typeof process !== "undefined" && process.env ? process.env.VITE_FIREBASE_DATABASE_ID : undefined;

export const firebaseConfig = {
  apiKey: firebaseAppletConfig.apiKey || viteApiKey || nodeApiKey,
  authDomain: firebaseAppletConfig.authDomain || viteAuthDomain || nodeAuthDomain,
  projectId: firebaseAppletConfig.projectId || viteProjectId || nodeProjectId,
  storageBucket: firebaseAppletConfig.storageBucket || viteStorageBucket || nodeStorageBucket,
  messagingSenderId: firebaseAppletConfig.messagingSenderId || viteMessagingSenderId || nodeMessagingSenderId,
  appId: firebaseAppletConfig.appId || viteAppId || nodeAppId,
  measurementId: firebaseAppletConfig.measurementId || viteMeasurementId || nodeMeasurementId,
};

// Resolve the database ID.
// If there is an explicit named database in firebase-applet-config.json or the environment, we use it.
// We must NEVER pass the string "default" (without parentheses) to initializeFirestore, as this will fail.
// We sanitize any variation of "default" or "(default)" to undefined (which triggers default DB).
function sanitizeDatabaseId(id: any, projectId: string): string | undefined {
  if (!id) return undefined;
  const trimmed = String(id).trim().toLowerCase();
  if (trimmed === "default" || trimmed === "(default)" || trimmed === "") {
    return undefined;
  }
  // If the target project is a custom user project (e.g. bincomcenterapp), ignore old auto-generated AI Studio database IDs
  if (projectId && !projectId.startsWith("ai-studio-") && trimmed.startsWith("ai-studio-")) {
    return undefined;
  }
  return String(id).trim();
}

const rawDbId = viteDatabaseId || nodeDatabaseId || firebaseAppletConfig.firestoreDatabaseId;
const dbId = sanitizeDatabaseId(rawDbId, firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Safe Initialization to avoid HMR multiple-initialization crashes.
function getSafeFirestoreInstance(databaseId: string | undefined) {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    }, databaseId);
  } catch (e: any) {
    // If already initialized, fetch the existing Firestore instance.
    return getFirestore(app, databaseId);
  }
}

// Keep a reference to the active Firestore instance
export const db = getSafeFirestoreInstance(dbId);

async function verifyConnectivity() {
  try {
    await getDoc(doc(db, "metadata", "connectivity_test"));
    console.log("✅ Firestore connected successfully to database ID:", dbId || "(default)");
  } catch (err: any) {
    const errMsg = String(err.message || err).toLowerCase();
    if (errMsg.includes("offline") || errMsg.includes("unavailable")) {
      console.warn("⚠️ Firestore transient connection notice:", errMsg);
    } else if (errMsg.includes("resource-exhausted") || errMsg.includes("quota")) {
      console.warn("⚠️ Firestore daily free-tier quota reached. Application will use cached/local state.");
    } else {
      console.warn("⚠️ Firestore connectivity check response:", errMsg);
    }
  }
}

// Run connectivity check asynchronously on module load
verifyConnectivity();

console.log("🔥 Firebase initialized successfully!");
console.log("📍 Project ID in use:", firebaseConfig.projectId);
console.log("🌐 Auth Domain in use:", firebaseConfig.authDomain);
console.log("📦 App ID:", firebaseConfig.appId);
console.log("🗄️ Database ID in use:", dbId || "(default)");


