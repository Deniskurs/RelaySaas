# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.11-slim-bookworm
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/dashboard/dist ./dashboard/dist

# Copy backend
COPY src/ ./src/

# Expose port
EXPOSE 8000

# Start server - debug env vars then start
CMD ["sh", "-c", "echo 'SUPABASE_URL set:' ${SUPABASE_URL:+yes}${SUPABASE_URL:-no} && python -m uvicorn src.api.server:app --host 0.0.0.0 --port 8000"]
