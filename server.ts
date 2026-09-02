import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy initialization of Gemini API
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Smart Tagging and Asset Analysis with Gemini
app.post("/api/smart-tag", async (req, res) => {
  try {
    const { assets } = req.body;
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      res.status(400).json({ error: "assets array is required" });
      return;
    }

    const ai = getGenAI();

    // Prepare prompt for batch or single asset analysis
    const assetPrompts = assets.map((a: any, index: number) => ({
      index,
      id: a.id,
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      parentFolderName: a.parentFolderName || "Root",
      description: a.description || "",
    }));

    const prompt = `You are an expert game development technical artist and audio director.
Analyze the following game development asset files from Google Drive and provide smart categorization, tags, genre/style, and suggested folder paths.

Assets to analyze:
${JSON.stringify(assetPrompts, null, 2)}

Provide analysis for each asset with:
- id: matching asset id
- category: one of ["imagery", "music", "sound", "ui", "3d", "fonts", "docs", "other"]
- subCategory: specific game dev subcategory (e.g., "character-sprite", "tilemap", "texture", "bgm-combat", "bgm-ambient", "ui-sfx", "footstep-sfx", "weapon-sound", "spell-effect", "hud-icon", "menu-frame", "pixel-font", "3d-prop")
- smartTags: array of 4 to 8 relevant lowercase tags prefixed with or without hash (e.g. ["pixel-art", "fantasy", "16-bit", "looping", "boss-fight", "sword-slash", "retro", "transparent-bg"])
- moodStyle: aesthetic or mood descriptor (e.g. "Chiptune / Retro 8-bit", "Dark Fantasy Orchestral", "Cyberpunk Synthwave", "Stylized Low-Poly", "Clean Modern UI")
- suggestedFolder: recommended folder structure path in standard game engine layout (e.g., "Assets/Audio/Music/Battle/", "Assets/Sprites/Characters/Player/", "Assets/UI/Icons/Inventory/", "Assets/Audio/SFX/Combat/")
- summary: 1-sentence description of what this asset is and how a game developer would use it.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: "one of imagery, music, sound, ui, 3d, fonts, docs, other",
                  },
                  subCategory: { type: Type.STRING },
                  smartTags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  moodStyle: { type: Type.STRING },
                  suggestedFolder: { type: Type.STRING },
                  summary: { type: Type.STRING },
                },
                required: ["id", "category", "subCategory", "smartTags", "moodStyle", "suggestedFolder", "summary"],
              },
            },
          },
          required: ["results"],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{"results": []}');
    res.json(parsed);
  } catch (error: any) {
    console.error("Error in smart-tag endpoint:", error);
    res.status(500).json({
      error: error?.message || "Failed to analyze assets",
    });
  }
});

// Smart Search Query Parser with Gemini
app.post("/api/smart-search-query", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query string is required" });
      return;
    }

    const ai = getGenAI();
    const prompt = `You are an intelligent search assistant for a game developer's asset library (sprites, audio, music, UI, 3D models).
The user entered this natural language search: "${query}".

Analyze the intent and extract:
1. Target categories: subset of ["imagery", "music", "sound", "ui", "3d", "fonts", "docs", "other"]
2. Keyword variations & synonyms that could appear in filenames (e.g. if query is "footsteps", keywords might include "step", "walk", "run", "gravel", "foley", "fs")
3. Suggested smart tags to filter by
4. Audio/visual mood or genre if implied (e.g., "retro", "scifi", "orchestral", "pixel")
5. Drive API query filter substring (e.g. name contains '...')`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            mood: { type: Type.STRING },
            driveQueryHints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            explanation: { type: Type.STRING },
          },
          required: ["categories", "keywords", "tags", "explanation"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Error in smart-search-query:", error);
    res.status(500).json({
      error: error?.message || "Failed to parse search query",
    });
  }
});

// Google Drive Media Proxy for Audio/Image preview in browser elements
// Enables streaming audio to <audio> and <video> tags without CORS or header auth limitations
app.get("/api/drive-proxy/file/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;

    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : queryToken;
    if (!token) {
      res.status(401).json({ error: "Access token required" });
      return;
    }

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const driveRes = await fetch(driveUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!driveRes.ok) {
      const errorText = await driveRes.text();
      res.status(driveRes.status).send(errorText);
      return;
    }

    const contentType = driveRes.headers.get("content-type") || "application/octet-stream";
    const contentLength = driveRes.headers.get("content-length");
    const contentRange = driveRes.headers.get("content-range");
    const acceptRanges = driveRes.headers.get("accept-ranges") || "bytes";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", acceptRanges);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    const arrayBuffer = await driveRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error("Error in drive proxy:", error);
    res.status(500).json({ error: error.message || "Failed to stream file" });
  }
});

// Vite middleware / production static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Game Asset Organizer running on http://localhost:${PORT}`);
  });
}

startServer();
