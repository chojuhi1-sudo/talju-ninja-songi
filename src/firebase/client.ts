import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_AUTH_PROVIDERS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export function isAnonymousAuthDisabledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const msg = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/admin-restricted-operation' ||
    msg.includes('operation-not-allowed') ||
    msg.includes('admin-restricted-operation') ||
    msg.includes('ADMIN_ONLY_OPERATION')
  );
}

let connectionTested = false;

export async function testConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

let authReadyPromise: Promise<User | null> | null = null;
let pendingAnonSignIn: Promise<User> | null = null;

function waitForInitialAuthState(): Promise<User | null> {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }
  if (!authReadyPromise) {
    authReadyPromise = new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user);
        },
        () => {
          unsubscribe();
          resolve(null);
        }
      );
    });
  }
  return authReadyPromise;
}

export interface AnonymousAuthResult {
  user: User | null;
  errorCode: string | null;
  needsAnonymousAuthEnable: boolean;
  errorMessage: string | null;
}

/**
 * Ensures the browser session has a Firebase Anonymous Authentication user ID.
 * Never prompts for Google or email login. Deduplicates concurrent sign-in requests.
 */
export async function ensureAnonymousUser(): Promise<AnonymousAuthResult> {
  try {
    const existing = await waitForInitialAuthState();
    if (existing) {
      return {
        user: existing,
        errorCode: null,
        needsAnonymousAuthEnable: false,
        errorMessage: null,
      };
    }

    if (!pendingAnonSignIn) {
      pendingAnonSignIn = signInAnonymously(auth)
        .then((cred) => cred.user)
        .finally(() => {
          pendingAnonSignIn = null;
        });
    }

    const user = await pendingAnonSignIn;
    return {
      user,
      errorCode: null,
      needsAnonymousAuthEnable: false,
      errorMessage: null,
    };
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? 'auth/unknown')
        : 'auth/unknown';
    const needsEnable = isAnonymousAuthDisabledError(error);
    return {
      user: null,
      errorCode: code,
      needsAnonymousAuthEnable: needsEnable,
      errorMessage: needsEnable
        ? 'Firebase 콘솔에서 익명 인증(Anonymous) 제공자를 활성화해야 실시간 공용 랭킹을 사용할 수 있습니다.'
        : '익명 인증 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
    };
  }
}
