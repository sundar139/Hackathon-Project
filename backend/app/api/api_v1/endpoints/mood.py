
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.MoodCheckin])
def read_mood_checkins(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve mood check-ins.
    """
    # Assuming crud.mood_checkin exists or we use a generic one
    mood_checkins = crud.mood_checkin.get_multi_by_owner(
        db=db, owner_id=current_user.id, skip=skip, limit=limit
    )
    return mood_checkins

@router.post("/", response_model=schemas.MoodCheckin)
def create_mood_checkin(
    *,
    db: Session = Depends(deps.get_db),
    mood_in: schemas.MoodCheckinCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new mood check-in.
    """
    mood_checkin = crud.mood_checkin.create_with_owner(db=db, obj_in=mood_in, owner_id=current_user.id)
    return mood_checkin

@router.post("/analyze", response_model=schemas.MoodInsight)
async def analyze_mood(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Analyze recent mood logs and provide insights.
    """
    # Use AIService to analyze mood
    from app.services.ai_service import ai_service
    
    # Retrieve recent mood logs
    mood_history = crud.mood_checkin.get_multi_by_owner(
        db=db, owner_id=current_user.id, limit=5
    )
    # Convert to dict for service
    history_dicts = [
        {
            "mood_valence": m.mood_valence,
            "energy_level": m.energy_level,
            "stress_level": m.stress_level,
            "created_at": m.created_at
        } for m in mood_history
    ]
    
    analysis = await ai_service.analyze_mood(history_dicts)
    return schemas.MoodInsight(**analysis)
