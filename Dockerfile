# ── Stage: production image ───────────────────────────────────────────────────
# Uses Node 18 slim (small footprint, no dev tools)
FROM node:18-slim

# Set working directory inside the container
# Every relative path from here is /app/...
WORKDIR /app

# ── Install dependencies ───────────────────────────────────────────────────────
# Copy ONLY package files first so Docker can cache this layer.
# If your code changes but package.json does not, npm install is skipped.
COPY Backend/package*.json ./Backend/

RUN cd Backend && npm install --omit=dev

# ── Copy source code ───────────────────────────────────────────────────────────
# Copy everything: Backend/ and Frontend/ both land under /app/
COPY . .

# ── Expose the port the server listens on ─────────────────────────────────────
EXPOSE 5000

# ── Start the server ──────────────────────────────────────────────────────────
# CWD is /app, so dotenv.config() finds /app/.env (copied from project root)
CMD ["node", "Backend/server.js"]
