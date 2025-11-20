
from fastapi import APIRouter

from app.api.api_v1.endpoints import (
    auth,
    users,
    assignments,
    mood,
    interventions,
    chat,
    peer_groups,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(assignments.router, prefix="/assignments", tags=["assignments"])
api_router.include_router(mood.router, prefix="/mood", tags=["mood"])
api_router.include_router(interventions.router, prefix="/interventions", tags=["interventions"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
# api_router.include_router(schedule.router, prefix="/schedule", tags=["schedule"])
api_router.include_router(peer_groups.router, prefix="/peer-groups", tags=["peer-groups"])
