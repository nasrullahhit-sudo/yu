import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const WORKSPACE_SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

const app = initializeApp(firebaseConfig);
const configuredDbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = configuredDbId ? getFirestore(app, configuredDbId) : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => googleProvider.addScope(scope));

// Strictly in-memory OAuth access token cache (never stored in localStorage/sessionStorage)
let cachedDriveAccessToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

function setCachedDriveAccessToken(token: string | null) {
  cachedDriveAccessToken = token;
  tokenListeners.forEach((cb) => {
    try {
      cb(token);
    } catch {
      // Ignore listener error
    }
  });
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    setCachedDriveAccessToken(null);
  }
});

export function getGoogleDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function clearGoogleDriveAccessToken(): void {
  setCachedDriveAccessToken(null);
}

export function subscribeGoogleDriveToken(listener: (token: string | null) => void): () => void {
  tokenListeners.add(listener);
  listener(cachedDriveAccessToken);
  return () => {
    tokenListeners.delete(listener);
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    setCachedDriveAccessToken(credential.accessToken);
  }
  return result;
}

export async function connectGoogleDrive(): Promise<string> {
  if (cachedDriveAccessToken) return cachedDriveAccessToken;
  const result = await signInWithGoogle();
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || cachedDriveAccessToken;
  if (!token) {
    throw new Error('Google Drive অ্যাক্সেস অনুমতি পাওয়া যায়নি। আবার চেষ্টা করুন।');
  }
  setCachedDriveAccessToken(token);
  return token;
}

export async function signOutUser() {
  setCachedDriveAccessToken(null);
  return signOut(auth);
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();
