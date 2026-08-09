import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "FRESCO Nuclear Physics Simulator Engine" });
  });

  // Fortran Engine API Routes
  app.get("/api/fortran/status", async (_req, res) => {
    try {
      const { getFortranEngineStatus } = await import("./src/fortran/frescoWrapper");
      const status = await getFortranEngineStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fortran/compile", async (_req, res) => {
    try {
      const { compileFortranSources } = await import("./src/fortran/frescoWrapper");
      const result = await compileFortranSources();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/fortran/run-fresco", async (req, res) => {
    try {
      const { deckText, config } = req.body;
      const { runFortranFresco, getFortranEngineStatus } = await import("./src/fortran/frescoWrapper");
      const status = await getFortranEngineStatus();

      if (status.hasFrescoBinary || status.hasGfortran) {
        const result = await runFortranFresco(deckText || config);
        return res.json(result);
      } else {
        // Fallback to TS engine if native Fortran binary is uncompiled/unavailable
        const { runFrescoSimulation } = await import("./src/physics/frescoEngine");
        const { parseFrescoDeck } = await import("./src/physics/frescoParser");
        const deckConfig = config || (deckText ? parseFrescoDeck(deckText) : null);

        if (!deckConfig) {
          return res.status(400).json({ error: "No valid FRESCO configuration or deck text provided." });
        }

        const output = await runFrescoSimulation(deckConfig);
        return res.json({
          success: true,
          engineUsed: "TypeScript High-Speed Physics Engine",
          exitCode: 0,
          output,
          stdout: output.frescoOut,
          stderr: "",
          fort16Raw: output.fort16,
          frescoOutRaw: output.frescoOut,
        });
      }
    } catch (err: any) {
      console.error("Fortran execution error:", err);
      return res.status(500).json({ error: err.message || "Fortran execution failed." });
    }
  });

  // Gemini AI route for FRESCO input deck generation, parameter tuning, and physics guidance
  app.post("/api/gemini", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ error: "GEMINI_API_KEY is not configured in environment." });
      }

      const { prompt, systemInstruction } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      return res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini API error:", err);
      return res.status(500).json({ error: err.message || "Failed to query Gemini AI model." });
    }
  });

  // Serve static files / Vite middleware
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
    console.log(`FRESCO Applet Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
