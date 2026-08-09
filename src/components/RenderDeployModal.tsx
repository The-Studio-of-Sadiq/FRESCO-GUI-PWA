import React, { useState } from 'react';
import { CloudUpload, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

export const RenderDeployModal: React.FC = () => {
  const [copiedDocker, setCopiedDocker] = useState<boolean>(false);
  const [copiedRender, setCopiedRender] = useState<boolean>(false);

  const dockerfileCode = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.cjs"]`;

  const renderYamlCode = `services:
  - type: web
    name: fresco-nuclear-simulator
    env: docker
    plan: free
    region: oregon
    dockerfilePath: Dockerfile
    envVars:
      - key: GEMINI_API_KEY
        sync: false`;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800 text-cyan-400">
            <CloudUpload className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Render.com Docker Deployment Guide</h2>
            <p className="text-xs text-slate-400">
              Deploy your native FRESCO Nuclear Physics Web Applet to Render.com using Docker containers.
            </p>
          </div>
        </div>

        {/* Deployment Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center text-xs">
              1
            </span>
            <h4 className="font-bold text-white text-sm">Export / Commit Repository</h4>
            <p className="text-slate-400">
              Export this project workspace to GitHub or download as a ZIP file from the AI Studio menu.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center text-xs">
              2
            </span>
            <h4 className="font-bold text-white text-sm">Create New Web Service on Render</h4>
            <p className="text-slate-400">
              Log into Render.com, select <strong>New Web Service</strong>, connect your GitHub repo, and choose <strong>Docker</strong> runtime environment.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center text-xs">
              3
            </span>
            <h4 className="font-bold text-white text-sm">Set Environment Variables</h4>
            <p className="text-slate-400">
              Add `GEMINI_API_KEY` under <strong>Environment Variables</strong> in the Render dashboard.
            </p>
          </div>
        </div>

        {/* Dockerfile & render.yaml Viewers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Dockerfile */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between font-sans">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Terminal className="w-4 h-4" /> Dockerfile
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(dockerfileCode);
                  setCopiedDocker(true);
                  setTimeout(() => setCopiedDocker(false), 2000);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                {copiedDocker ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <pre className="text-slate-300 bg-slate-900 p-3 rounded-xl overflow-x-auto leading-relaxed">
              {dockerfileCode}
            </pre>
          </div>

          {/* render.yaml */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between font-sans">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <Terminal className="w-4 h-4" /> render.yaml
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(renderYamlCode);
                  setCopiedRender(true);
                  setTimeout(() => setCopiedRender(false), 2000);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                {copiedRender ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <pre className="text-slate-300 bg-slate-900 p-3 rounded-xl overflow-x-auto leading-relaxed">
              {renderYamlCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
