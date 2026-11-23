import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.database import Base, engine
import app.models  # Registers all models on Base

from app.routers.auth import router as auth_router
from app.routers.relationships import router as relationships_router
from app.routers.medicines import router as medicines_router
from app.routers.occurrences import router as occurrences_router
from app.routers.proofs import router as proofs_router
from app.routers.notifications import router as notifications_router
from app.services.scheduler import scheduler_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create database tables
    Base.metadata.create_all(bind=engine)
    print("[STARTUP] CareSync database tables initialized.")

    # 2. Start background scheduler for missed dose detection & warnings (every 10s for ultra-fast reaction)
    scheduler_task = asyncio.create_task(scheduler_loop(interval_seconds=10))
    print("[STARTUP] CareSync background worker active.")

    yield

    # Shutdown
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        print("[SHUTDOWN] Scheduler task cancelled.")


app = FastAPI(
    title=settings.app_name,
    description=settings.app_tagline,
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — filter out wildcard when credentials are enabled
safe_origins = [o for o in settings.cors_origin_list if o != "*"]
if not safe_origins:
    safe_origins = ["http://localhost:8000", "http://127.0.0.1:8000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=safe_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Custom 422 error handler — prevents [object Object] in frontend
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = err.get("loc", ["", "unknown"])[-1]
        msg = err.get("msg", "Invalid value").replace("Value error, ", "")
        errors.append(f"{field}: {msg}")
    return JSONResponse(
        status_code=422,
        content={"detail": " • ".join(errors)},
    )


# API Routers
app.include_router(auth_router)
app.include_router(relationships_router)
app.include_router(medicines_router)
app.include_router(occurrences_router)
app.include_router(proofs_router)
app.include_router(notifications_router)


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "tagline": settings.app_tagline,
        "email_configured": bool(settings.email_from) if settings.resend_api_key else bool(settings.smtp_username and settings.smtp_password),
        "smtp_configured": bool(settings.smtp_username and settings.smtp_password),
    }


# Static Files & SPA Route Fallback
static_dir = os.path.join(os.path.dirname(__file__), "static")
index_file = os.path.join(static_dir, "index.html")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Return proper 404 for unknown /api/* routes
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return JSONResponse(status_code=404, content={"detail": "API endpoint not found."})
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"message": "CareSync API is running."}

