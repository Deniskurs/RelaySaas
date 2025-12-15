"""FastAPI application setup."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from .routes import router
from .onboarding_routes import router as onboarding_router
from .admin_routes import router as admin_router
from .plans_routes import router as plans_router
from .stripe_routes import router as stripe_router
from .websocket import websocket_endpoint, setup_websocket_events
from ..utils.logger import log


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    log.info("Starting Signal Copier API")
    setup_websocket_events()
    yield
    # Shutdown
    log.info("Shutting down Signal Copier API")


app = FastAPI(
    title="Signal Copier API",
    description="Telegram trading signal copier with AI parsing",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for dashboard
# Set CORS_ORIGINS env var in production (e.g., "https://your-app.up.railway.app")
allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(router, prefix="/api")
app.include_router(onboarding_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(plans_router, prefix="/api")
app.include_router(stripe_router, prefix="/api")

# WebSocket endpoint
app.add_api_websocket_route("/ws", websocket_endpoint)


# Serve SPA from dashboard/dist if it exists (production)
dashboard_path = os.path.join(os.path.dirname(__file__), "../../dashboard/dist")

if os.path.exists(dashboard_path):
    # Cache durations
    CACHE_STATIC_MAX_AGE = 31536000  # 1 year for hashed assets
    CACHE_SHORT_MAX_AGE = 3600  # 1 hour for non-hashed static files

    # File extensions that are hashed by Vite (can be cached long-term)
    HASHED_EXTENSIONS = {'.js', '.css'}
    # Static file extensions (shorter cache)
    STATIC_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot'}

    def get_cache_headers(file_path: str) -> dict:
        """Get appropriate cache headers based on file type."""
        ext = os.path.splitext(file_path)[1].lower()

        # Hashed assets (contain hash in filename like index-abc123.js)
        if ext in HASHED_EXTENSIONS:
            return {"Cache-Control": f"public, max-age={CACHE_STATIC_MAX_AGE}, immutable"}
        # Static assets like images, fonts
        elif ext in STATIC_EXTENSIONS:
            return {"Cache-Control": f"public, max-age={CACHE_SHORT_MAX_AGE}"}
        # Everything else (including index.html) - no cache
        return {"Cache-Control": "no-cache, no-store, must-revalidate"}

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA with proper cache headers."""
        # Try to serve the requested file
        file_path = os.path.join(dashboard_path, full_path)
        if full_path and os.path.isfile(file_path):
            headers = get_cache_headers(file_path)
            return FileResponse(file_path, headers=headers)
        # Fall back to index.html for SPA routing (no cache)
        return FileResponse(
            os.path.join(dashboard_path, "index.html"),
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
else:
    @app.get("/")
    async def root():
        """Root endpoint (development mode)."""
        return {
            "name": "Signal Copier API",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/api/health",
            "note": "Dashboard not built. Run 'npm run build' in dashboard/"
        }
