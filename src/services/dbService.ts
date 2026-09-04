import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { getApps, initializeApp, getApp } from "firebase/app";
import firebaseConfig from "../../firebase-applet-config.json";
import { EnrichedAsset, AssetCollection, UserPreferences } from "../types";

// Safe singleton Firebase app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Bind to provisioned Firestore database ID
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);

const ASSETS_COLLECTION = "vault_assets";
const COLLECTIONS_COLLECTION = "asset_collections";
const PREFS_COLLECTION = "user_preferences";

// Helper to sanitize undefined values before saving to Firestore
function cleanForFirestore<T extends Record<string, any>>(data: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Persist or update a single asset in the user's Firestore vault
 */
export async function saveAssetToDb(
  userId: string,
  asset: EnrichedAsset
): Promise<void> {
  if (!userId || !asset.id) return;
  try {
    const assetRef = doc(db, ASSETS_COLLECTION, `${userId}_${asset.id}`);
    const now = new Date().toISOString();

    const dataToSave = cleanForFirestore({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      extension: asset.extension || "",
      mimeType: asset.mimeType || "application/octet-stream",
      fileSize: asset.size ? parseInt(asset.size, 10) || 0 : 0,
      thumbnailLink: asset.thumbnailLink || "",
      webViewLink: asset.webViewLink || "",
      userTags: asset.userTags || [],
      smartTags: asset.smart?.smartTags || [],
      moodStyle: asset.smart?.moodStyle || "",
      suggestedFolder: asset.smart?.suggestedFolder || "",
      folderName: asset.folderName || "",
      folderId: asset.folderId || "",
      summary: asset.smart?.summary || "",
      subCategory: asset.smart?.subCategory || "",
      isFavorite: Boolean(asset.isFavorite),
      notes: asset.notes || "",
      userId,
      updatedAt: now,
    });

    await setDoc(assetRef, dataToSave, { merge: true });
  } catch (error) {
    console.error(`Error saving asset ${asset.id} to Firestore:`, error);
    throw error;
  }
}

/**
 * Batch save scanned or tagged assets to the database
 */
export async function batchSaveAssetsToDb(
  userId: string,
  assets: EnrichedAsset[]
): Promise<number> {
  if (!userId || assets.length === 0) return 0;
  try {
    // Firestore batches are limited to 500 operations
    const CHUNK_SIZE = 400;
    let savedCount = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < assets.length; i += CHUNK_SIZE) {
      const chunk = assets.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const asset of chunk) {
        if (!asset.id) continue;
        const assetRef = doc(db, ASSETS_COLLECTION, `${userId}_${asset.id}`);
        const data = cleanForFirestore({
          id: asset.id,
          name: asset.name,
          category: asset.category,
          extension: asset.extension || "",
          mimeType: asset.mimeType || "application/octet-stream",
          fileSize: asset.size ? parseInt(asset.size, 10) || 0 : 0,
          thumbnailLink: asset.thumbnailLink || "",
          webViewLink: asset.webViewLink || "",
          userTags: asset.userTags || [],
          smartTags: asset.smart?.smartTags || [],
          moodStyle: asset.smart?.moodStyle || "",
          suggestedFolder: asset.smart?.suggestedFolder || "",
          folderName: asset.folderName || "",
          folderId: asset.folderId || "",
          summary: asset.smart?.summary || "",
          subCategory: asset.smart?.subCategory || "",
          isFavorite: Boolean(asset.isFavorite),
          notes: asset.notes || "",
          userId,
          updatedAt: now,
        });
        batch.set(assetRef, data, { merge: true });
        savedCount++;
      }

      await batch.commit();
    }
    return savedCount;
  } catch (error) {
    console.error("Error batch saving assets to Firestore:", error);
    throw error;
  }
}

/**
 * Retrieve all persisted vault assets for an authenticated user
 */
export async function loadUserAssetsFromDb(userId: string): Promise<EnrichedAsset[]> {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, ASSETS_COLLECTION),
      where("userId", "==", userId)
    );

    const snapshot = await getDocs(q);
    const loadedAssets: EnrichedAsset[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      loadedAssets.push({
        id: data.id,
        name: data.name,
        category: data.category,
        extension: data.extension || "",
        mimeType: data.mimeType || "application/octet-stream",
        size: data.fileSize ? String(data.fileSize) : undefined,
        thumbnailLink: data.thumbnailLink || undefined,
        webViewLink: data.webViewLink || undefined,
        userTags: Array.isArray(data.userTags) ? data.userTags : [],
        isFolder: false,
        isFavorite: Boolean(data.isFavorite),
        notes: data.notes || "",
        updatedAt: data.updatedAt || undefined,
        userId: data.userId,
        folderName: data.folderName || undefined,
        folderId: data.folderId || undefined,
        smart: data.smartTags || data.moodStyle || data.summary
          ? {
              category: data.category,
              subCategory: data.subCategory || data.category,
              smartTags: Array.isArray(data.smartTags) ? data.smartTags : [],
              moodStyle: data.moodStyle || "",
              suggestedFolder: data.suggestedFolder || "",
              summary: data.summary || "",
            }
          : undefined,
      });
    });

    return loadedAssets;
  } catch (error) {
    console.error("Error loading assets from Firestore:", error);
    return [];
  }
}

/**
 * Toggle favorite status in Firestore
 */
export async function toggleFavoriteInDb(
  userId: string,
  assetId: string,
  isFavorite: boolean
): Promise<void> {
  if (!userId || !assetId) return;
  try {
    const assetRef = doc(db, ASSETS_COLLECTION, `${userId}_${assetId}`);
    await setDoc(
      assetRef,
      { isFavorite, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (error) {
    console.error("Error toggling favorite in Firestore:", error);
    throw error;
  }
}

/**
 * Delete an asset from Firestore
 */
export async function deleteAssetFromDb(
  userId: string,
  assetId: string
): Promise<void> {
  if (!userId || !assetId) return;
  try {
    const assetRef = doc(db, ASSETS_COLLECTION, `${userId}_${assetId}`);
    await deleteDoc(assetRef);
  } catch (error) {
    console.error("Error deleting asset from Firestore:", error);
    throw error;
  }
}

/**
 * Save user preferences
 */
export async function saveUserPreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<void> {
  if (!userId) return;
  try {
    const prefRef = doc(db, PREFS_COLLECTION, userId);
    await setDoc(
      prefRef,
      {
        ...prefs,
        userId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error saving user preferences to Firestore:", error);
  }
}

/**
 * Load user preferences
 */
export async function loadUserPreferences(
  userId: string
): Promise<UserPreferences | null> {
  if (!userId) return null;
  try {
    const prefRef = doc(db, PREFS_COLLECTION, userId);
    const snap = await getDoc(prefRef);
    if (snap.exists()) {
      return snap.data() as UserPreferences;
    }
    return null;
  } catch (error) {
    console.error("Error loading user preferences from Firestore:", error);
    return null;
  }
}

/**
 * Save custom collection/pack
 */
export async function saveCollectionToDb(
  userId: string,
  col: AssetCollection
): Promise<void> {
  if (!userId || !col.id) return;
  try {
    const colRef = doc(db, COLLECTIONS_COLLECTION, `${userId}_${col.id}`);
    await setDoc(colRef, {
      ...cleanForFirestore(col),
      userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error("Error saving collection to Firestore:", error);
    throw error;
  }
}

/**
 * Load collections for user
 */
export async function loadCollectionsFromDb(
  userId: string
): Promise<AssetCollection[]> {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, COLLECTIONS_COLLECTION),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const collections: AssetCollection[] = [];
    snapshot.forEach((snap) => {
      collections.push(snap.data() as AssetCollection);
    });
    return collections;
  } catch (error) {
    console.error("Error loading collections from Firestore:", error);
    return [];
  }
}
