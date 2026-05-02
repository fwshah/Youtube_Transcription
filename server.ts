import express from "express";
import { createServer as createViteServer } from "vite";
import ytdl from "@distube/ytdl-core";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse Netscape cookie file robustly
function parseCookiesFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[COOKIES] Cookie file not found at ${filePath}. Authenticated requests might fail.`);
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const cookies: any[] = [];
    
    // Split by any newline sequence
    const lines = content.split(/\r?\n/);
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith("#")) continue;
      
      // Netscape format fields are separated by tabs
      const parts = line.split("\t");
      
      // We expect at least 7 fields for a valid Netscape cookie record
      if (parts.length >= 7) {
        cookies.push({
          domain: parts[0],
          path: parts[2],
          secure: parts[3].toUpperCase() === "TRUE",
          expirationDate: parseInt(parts[4], 10) || 0,
          name: parts[5],
          value: parts[6].trim()
        });
      }
    }
    
    console.log(`[COOKIES] Successfully parsed ${cookies.length} cookies.`);
    return cookies;
  } catch (error) {
    console.error("[COOKIES] Unexpected error parsing cookies file:", error);
    return [];
  }
}

const COOKIE_PATH = path.join(process.cwd(), "cookies.txt");
const youtubeAgent = ytdl.createAgent(parseCookiesFile(COOKIE_PATH));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API to get video information
  app.get("/api/video-info", async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log(`[VIDEO-INFO] Request for URL: ${videoUrl}`);
      
      // Basic validation
      if (!videoUrl.includes("youtube.com") && !videoUrl.includes("youtu.be")) {
        console.warn(`[VIDEO-INFO] Invalid domain for URL: ${videoUrl}`);
        return res.status(400).json({ error: "Please provide a valid YouTube URL." });
      }

      const info = await ytdl.getInfo(videoUrl, { 
        agent: youtubeAgent,
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          }
        }
      }).catch(err => {
        console.error(`[VIDEO-INFO] ytdl.getInfo failed:`, err.message);
        throw new Error(`YouTube reached but could not extract info: ${err.message}`);
      });

      console.log(`[VIDEO-INFO] Successfully retrieved info for: ${info.videoDetails.title}`);
      
      const audioFormat = ytdl.chooseFormat(info.formats, { 
        quality: 'lowestaudio', 
        filter: 'audioonly' 
      });
      
      if (!audioFormat || !audioFormat.url) {
        console.warn(`[VIDEO-INFO] No audio format found for: ${info.videoDetails.title}`);
        throw new Error("Could not find a valid audio format for this video. It might be restricted or have no audio stream.");
      }

      res.json({
        title: info.videoDetails.title,
        author: info.videoDetails.author.name,
        thumbnail: info.videoDetails.thumbnails[0]?.url,
        duration: info.videoDetails.lengthSeconds,
        audioUrl: audioFormat.url,
      });
    } catch (error: any) {
      console.error("[VIDEO-INFO] Final Error:", error);
      res.status(500).json({ error: error.message || "An unexpected error occurred while fetching video details." });
    }
  });

  // API to proxy audio stream to avoid CORS and handle headers
  app.get("/api/proxy-audio", async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) {
      return res.status(400).send("Audio URL is required");
    }

    try {
      console.log(`Proxying audio stream...`);
      const response = await fetch(audioUrl, {
        headers: {
          'Range': 'bytes=0-', // Request the whole stream
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.error(`Audio fetch failed with status: ${response.status}`);
        throw new Error(`Failed to fetch audio stream: ${response.statusText}`);
      }
      
      res.setHeader("Content-Type", "audio/mpeg");
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Audio stream body is empty");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (error: any) {
      console.error("Proxy stream error:", error);
      res.status(500).send(error.message);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
