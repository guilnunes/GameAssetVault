import { DriveFileItem, EnrichedAsset, AssetCategory, SmartMetadata } from "../types";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length <= 1) return "";
  return parts[parts.length - 1].toLowerCase();
}

// Categorize game assets by extension and naming heuristics
export function categorizeAsset(item: DriveFileItem): AssetCategory {
  const name = item.name.toLowerCase();
  const mime = item.mimeType?.toLowerCase() || "";
  const ext = getFileExtension(item.name);

  if (item.properties?.category) {
    return item.properties.category as AssetCategory;
  }

  // 1. Audio / Music vs Sound FX
  if (
    mime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "flac", "m4a", "aac", "mid", "midi"].includes(ext)
  ) {
    if (
      name.includes("bgm") ||
      name.includes("theme") ||
      name.includes("ost") ||
      name.includes("track") ||
      name.includes("music") ||
      name.includes("ambient") ||
      name.includes("loop") ||
      name.includes("song")
    ) {
      return "music";
    }
    if (
      name.includes("sfx") ||
      name.includes("hit") ||
      name.includes("click") ||
      name.includes("explosion") ||
      name.includes("jump") ||
      name.includes("footstep") ||
      name.includes("slash") ||
      name.includes("coin") ||
      name.includes("foley") ||
      name.includes("attack") ||
      name.includes("ui_") ||
      name.includes("snd_")
    ) {
      return "sound";
    }
    // Default audio longer or unspecified
    return (parseInt(item.size || "0", 10) > 3 * 1024 * 1024) ? "music" : "sound";
  }

  // 2. UI Elements
  if (
    name.includes("ui") ||
    name.includes("hud") ||
    name.includes("button") ||
    name.includes("icon") ||
    name.includes("healthbar") ||
    name.includes("dialogue") ||
    name.includes("cursor") ||
    name.includes("frame") ||
    name.includes("inventory") ||
    name.includes("menu")
  ) {
    return "ui";
  }

  // 3. 2D Imagery (Sprites, Textures, Tilesets, Backgrounds)
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp", "tga", "psd", "ase", "aseprite"].includes(ext)
  ) {
    return "imagery";
  }

  // 4. 3D Models
  if (["fbx", "obj", "gltf", "glb", "blend", "dae", "3ds", "stl", "max", "c4d"].includes(ext)) {
    return "3d";
  }

  // 5. Fonts
  if (
    mime.includes("font") ||
    ["ttf", "otf", "woff", "woff2", "fnt"].includes(ext)
  ) {
    return "fonts";
  }

  // 6. Docs & Game Design
  if (
    mime.includes("pdf") ||
    mime.includes("document") ||
    mime.includes("sheet") ||
    ["pdf", "docx", "doc", "md", "txt", "gdd", "json", "csv"].includes(ext)
  ) {
    return "docs";
  }

  return "other";
}

// Convert DriveFileItem to EnrichedAsset with default and stored tags
export function enrichDriveAsset(item: DriveFileItem, folderName?: string): EnrichedAsset {
  const isFolder = item.mimeType === "application/vnd.google-apps.folder";
  const category = isFolder ? "other" : categorizeAsset(item);
  const ext = getFileExtension(item.name);

  // Extract user tags from Drive properties or description
  let userTags: string[] = [];
  if (item.properties?.tags) {
    userTags = item.properties.tags.split(",").map((t) => t.trim()).filter(Boolean);
  } else if (item.description && item.description.includes("#")) {
    const matched = item.description.match(/#[a-zA-Z0-9_-]+/g);
    if (matched) {
      userTags = matched.map((t) => t.replace("#", "").toLowerCase());
    }
  }

  let smart: SmartMetadata | undefined = undefined;
  if (item.properties?.smartMeta) {
    try {
      smart = JSON.parse(item.properties.smartMeta);
    } catch {
      // ignore
    }
  }

  const resolvedFolderName = folderName || item.properties?.folderName;

  return {
    ...item,
    category,
    extension: ext,
    isFolder,
    smart,
    userTags,
    folderName: resolvedFolderName,
    folderId: item.parents?.[0],
  };
}

// Fetch files from Google Drive
export async function fetchDriveFiles(
  token: string,
  options?: {
    parentFolderId?: string;
    searchTerm?: string;
    onlyGameAssets?: boolean;
  }
): Promise<EnrichedAsset[]> {
  const queryParts = ["trashed = false"];

  if (options?.parentFolderId && options.parentFolderId !== "all") {
    queryParts.push(`'${options.parentFolderId}' in parents`);
  }

  if (options?.searchTerm?.trim()) {
    const escaped = options.searchTerm.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  const query = queryParts.join(" and ");
  const fields =
    "files(id, name, mimeType, size, modifiedTime, thumbnailLink, webViewLink, iconLink, parents, description, properties, appProperties)";
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    query
  )}&fields=${encodeURIComponent(fields)}&pageSize=100&orderBy=folder,name`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const rawFiles: DriveFileItem[] = data.files || [];

  return rawFiles.map((item) => enrichDriveAsset(item));
}

// Fetch subfolders list for folder picker / navigation
export async function fetchDriveFolders(
  token: string,
  parentId?: string
): Promise<{ id: string; name: string; parents?: string[] }[]> {
  const queryParts = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ];
  if (parentId && parentId !== "all") {
    queryParts.push(`'${parentId}' in parents`);
  }

  const query = queryParts.join(" and ");
  const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(
    query
  )}&fields=files(id, name, parents)&pageSize=50&orderBy=name`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to load Google Drive folders (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

// Create a new folder on Drive (Requires confirmation in UI)
export async function createDriveFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<{ id: string; name: string }> {
  const body: any = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId && parentId !== "all") {
    body.parents = [parentId];
  }

  const response = await fetch(`${DRIVE_API_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to create folder: ${err}`);
  }

  return response.json();
}

// Move file to target folder on Drive (Requires confirmation in UI)
export async function moveDriveFile(
  token: string,
  fileId: string,
  newParentId: string,
  currentParentId?: string
): Promise<void> {
  let url = `${DRIVE_API_BASE}/files/${fileId}?addParents=${newParentId}`;
  if (currentParentId) {
    url += `&removeParents=${currentParentId}`;
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to move file ${fileId}: ${err}`);
  }
}

// Save smart tags and category into Google Drive file properties & description
export async function updateDriveAssetMetadata(
  token: string,
  fileId: string,
  metadata: {
    category?: AssetCategory;
    tags?: string[];
    description?: string;
    smartMeta?: SmartMetadata;
  }
): Promise<void> {
  const properties: Record<string, string> = {};
  if (metadata.category) properties.category = metadata.category;
  if (metadata.tags) properties.tags = metadata.tags.join(",");
  if (metadata.smartMeta) properties.smartMeta = JSON.stringify(metadata.smartMeta);

  const body: any = { properties };
  if (metadata.description !== undefined) {
    body.description = metadata.description;
  }

  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to save metadata to Drive: ${err}`);
  }
}

// Client-side fallback smart metadata generator for static environments (e.g. GitHub Pages)
export function generateClientSmartMetadata(asset: {
  id: string;
  name: string;
  category: AssetCategory;
  extension?: string;
}): SmartMetadata {
  const lowerName = asset.name.toLowerCase();
  const ext = (asset.extension || getFileExtension(asset.name)).toLowerCase();

  const tags: string[] = [asset.category];
  let mood = "Standard Game Asset";
  let folder = `Assets/${asset.category.toUpperCase()}/`;

  if (asset.category === "imagery") {
    folder = "Assets/Sprites/";
    mood = lowerName.includes("pixel") ? "16-Bit Pixel Art" : "Stylized 2D Graphic";
    tags.push("2d-sprite", "texture", ext);
    if (lowerName.includes("pixel")) tags.push("pixel-art", "retro");
    if (lowerName.includes("idle") || lowerName.includes("walk") || lowerName.includes("attack")) tags.push("animated", "spritesheet");
    if (lowerName.includes("tile") || lowerName.includes("map")) tags.push("tilemap", "environment");
  } else if (asset.category === "music") {
    folder = "Assets/Audio/Music/";
    mood = lowerName.includes("boss") ? "Intense Boss Battle" : lowerName.includes("town") ? "Peaceful Village Atmosphere" : "Cinematic Game Score";
    tags.push("bgm", "soundtrack", "audio-loop", ext);
    if (lowerName.includes("retro") || lowerName.includes("8bit") || lowerName.includes("chiptune")) tags.push("chiptune", "8-bit");
    if (lowerName.includes("ambient")) tags.push("ambient", "atmospheric");
  } else if (asset.category === "sound") {
    folder = "Assets/Audio/SFX/";
    mood = "Action Sound FX";
    tags.push("sfx", "audio", "foley", ext);
    if (lowerName.includes("click") || lowerName.includes("button")) tags.push("ui-sfx");
    if (lowerName.includes("sword") || lowerName.includes("hit") || lowerName.includes("punch")) tags.push("combat-sfx");
    if (lowerName.includes("laser") || lowerName.includes("gun")) tags.push("sci-fi-sfx");
  } else if (asset.category === "ui") {
    folder = "Assets/UI/";
    mood = "Game Interface & HUD";
    tags.push("ui-element", "hud", "interface", ext);
    if (lowerName.includes("icon")) tags.push("icon");
    if (lowerName.includes("frame") || lowerName.includes("border")) tags.push("window-frame");
  } else if (asset.category === "3d") {
    folder = "Assets/Models/";
    mood = "3D Asset / Mesh";
    tags.push("3d-model", "mesh", ext);
  } else if (asset.category === "fonts") {
    folder = "Assets/Fonts/";
    mood = "Game Typography";
    tags.push("font", "typography", ext);
  }

  return {
    category: asset.category,
    subCategory: tags[1] || asset.category,
    smartTags: Array.from(new Set(tags)),
    moodStyle: mood,
    suggestedFolder: folder,
    summary: `Game development ${asset.category} asset (${asset.name}) ready for engine integration.`,
  };
}
