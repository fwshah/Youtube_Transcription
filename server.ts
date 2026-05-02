import express from "express";
import { createServer as createViteServer } from "vite";
import ytdl from "ytdl-core";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      if (!ytdl.validateURL(videoUrl)) {
        return res.status(400).json({ error: "Invalid YouTube URL" });
      }

      const info = await ytdl.getInfo(videoUrl);
      const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio', filter: 'audioonly' });
      
      res.json({
        title: info.videoDetails.title,
        author: info.videoDetails.author.name,
        thumbnail: info.videoDetails.thumbnails[0]?.url,
        duration: info.videoDetails.lengthSeconds,
        audioUrl: audioFormat.url,
      });
    } catch (error: any) {
      console.error("Error getting video info:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API to proxy audio stream to avoid CORS
  app.get("/api/proxy-audio", async (req, res) => {
    const audioUrl = req.query.url as string;
    if (!audioUrl) {
      return res.status(400).send("Audio URL is required");
    }

    try {
      const response = await fetch(audioUrl);
      if (!response.ok) throw new Error("Failed to fetch audio");
      
      // Set headers for audio streaming
      res.setHeader("Content-Type", "audio/mpeg");
      
      // Pipe the response body to Express response
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (error: any) {
      console.error("Proxy error:", error);
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
