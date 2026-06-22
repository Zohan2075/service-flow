from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, drive, service_types, time_entries

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing needed since Alembic handles migrations
    yield
    # Shutdown: clean up connections


app = FastAPI(
    title="ServiceFlow API",
    description="Backend API for ServiceFlow — a service time tracking application.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(drive.router, prefix="/api/v1")
app.include_router(service_types.router, prefix="/api/v1")
app.include_router(time_entries.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env}
