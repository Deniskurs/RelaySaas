# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/dashboard

# Vite env vars need to be available at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN echo "Building with VITE_SUPABASE_URL=$VITE_SUPABASE_URL" && npm run build

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

# Start the full application (API + Telegram listener)
CMD ["sh", "-c", "echo Starting Signal Copier on port ${PORT:-8000} && python -m src.main"]
