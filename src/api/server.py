"""FastAPI application setup."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .routes import router
from .onboarding_routes import router as onboarding_router
from .admin_routes import router as admin_router
from .plans_routes import router as plans_router
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

# WebSocket endpoint
app.add_api_websocket_route("/ws", websocket_endpoint)


# Serve SPA from dashboard/dist if it exists (production)
dashboard_path = os.path.join(os.path.dirname(__file__), "../../dashboard/dist")

if os.path.exists(dashboard_path):
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the React SPA."""
        # Try to serve the requested file
        file_path = os.path.join(dashboard_path, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Fall back to index.html for SPA routing
        return FileResponse(os.path.join(dashboard_path, "index.html"))
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
