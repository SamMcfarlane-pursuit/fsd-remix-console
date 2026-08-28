import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Firestore,
} from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";
import firebaseConfigJson from "../../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore (with databaseId fallback)
let firestoreDb: Firestore;
try {
  if (firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== "(default)") {
    firestoreDb = getFirestore(app, firebaseConfigJson.firestoreDatabaseId);
  } else {
    firestoreDb = getFirestore(app);
  }
} catch (e) {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const auth: Auth = getAuth(app);

// Firestore Cloud Collections
export const COLLECTIONS = {
  OCCUPANTS: "occupants",
  LEDGER_ENTRIES: "ledger_entries",
  SYSTEM_STATE: "system_state",
  BROADCAST_LOGS: "broadcast_logs",
  CHAT_MESSAGES: "chat_messages",
} as const;

/**
 * Persist occupant record to Cloud Firestore
 */
export async function syncOccupantToFirestore(occupant: any) {
  try {
    if (!occupant || !occupant.id) return;
    const docRef = doc(db, COLLECTIONS.OCCUPANTS, occupant.id);
    await setDoc(
      docRef,
      {
        ...occupant,
        lastCloudSync: new Date().toISOString(),
        cloudTimestamp: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Firestore syncOccupant error:", err);
  }
}

/**
 * Persist immutable ledger entry to Cloud Firestore
 */
export async function syncLedgerEntryToFirestore(entry: any) {
  try {
    if (!entry || !entry.id) return;
    const docRef = doc(db, COLLECTIONS.LEDGER_ENTRIES, String(entry.id));
    await setDoc(
      docRef,
      {
        ...entry,
        cloudTimestamp: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Firestore syncLedgerEntry error:", err);
  }
}

/**
 * Persist system incident mode/state to Cloud Firestore
 */
export async function syncSystemStateToFirestore(state: any) {
  try {
    const docRef = doc(db, COLLECTIONS.SYSTEM_STATE, "floor_07_status");
    await setDoc(
      docRef,
      {
        ...state,
        cloudTimestamp: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Firestore syncSystemState error:", err);
  }
}

/**
 * Real-time listener for Firestore occupant updates
 */
export function subscribeToOccupants(callback: (occupants: any[]) => void) {
  try {
    const q = collection(db, COLLECTIONS.OCCUPANTS);
    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        callback(items);
      },
      (error) => {
        console.warn("Firestore occupants listener error:", error);
      }
    );
  } catch (e) {
    console.warn("Could not attach Firestore occupants listener:", e);
    return () => {};
  }
}
