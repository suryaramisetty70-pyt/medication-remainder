from app.routers.auth import router as auth_router
from app.routers.relationships import router as relationships_router
from app.routers.medicines import router as medicines_router
from app.routers.occurrences import router as occurrences_router
from app.routers.proofs import router as proofs_router
from app.routers.notifications import router as notifications_router

__all__ = [
    "auth_router",
    "relationships_router",
    "medicines_router",
    "occurrences_router",
    "proofs_router",
    "notifications_router",
]
