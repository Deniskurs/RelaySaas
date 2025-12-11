"""FastAPI application setup."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .routes import router
from .onboarding_routes import router as onboarding_router
from .admin_routes import router as admin_router
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(router, prefix="/api")
app.include_router(onboarding_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

# WebSocket endpoint
app.add_api_websocket_route("/ws", websocket_endpoint)


# Static files for dashboard (after build)
# Uncomment when dashboard is built:
# import os
# dashboard_path = os.path.join(os.path.dirname(__file__), "../../dashboard/dist")
# if os.path.exists(dashboard_path):
#     app.mount("/", StaticFiles(directory=dashboard_path, html=True), name="dashboard")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Signal Copier API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }
