from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from app.services.ai_service import ai_service

router = APIRouter()

@router.post("/breakdown", response_model=List[schemas.SubtaskCreate])
def generate_breakdown(
    *,
    assignment_in: schemas.AssignmentCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Generate subtasks for an assignment using AI.
    """
    subtasks = ai_service.generate_subtasks(
        assignment_in.title, 
        assignment_in.description, 
        assignment_in.difficulty
    )
    return subtasks

@router.post("/replan-week", response_model=List[schemas.ScheduleBlock])
def replan_week(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Replan the user's week based on pending assignments and mood.
    """
    # Fetch pending assignments
    assignments = crud.assignment.get_multi_by_owner(
        db=db, owner_id=current_user.id, status="NOT_STARTED" # Simplified status check
    )
    
    # Fetch current schedule (optional, for conflict checking)
    # current_schedule = crud.schedule.get_multi_by_owner(...)
    
    suggested_blocks = ai_service.replan_week(
        user_id=current_user.id,
        assignments=assignments,
        current_schedule=[]
    )
    
    # In a real app, we might save these as "suggested" blocks or return them for user approval.
    # For now, let's just return them.
    # We need to convert dicts to Pydantic models or just return as is if schema matches.
    return suggested_blocks

@router.post("/analyze-mood", response_model=schemas.MoodInsight)
def analyze_mood(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Analyze recent mood logs and provide an insight.
    """
    # Fetch recent mood logs
    mood_logs = crud.mood_log.get_multi_by_owner(
        db=db, owner_id=current_user.id, limit=7
    )
    
    if not mood_logs:
        return {"insight": "Start logging your mood to get personalized insights!"}
        
    # Simple mock analysis for now (replace with actual AI service call if available)
    avg_score = sum([log.score for log in mood_logs]) / len(mood_logs)
    
    if avg_score >= 7:
        insight = "You've been feeling great lately! Keep up the good work and maintain your healthy habits."
    elif avg_score >= 4:
        insight = "Your mood has been stable. Consider scheduling some relaxation time to boost your energy."
    else:
        insight = "It seems like you've been having a tough time. Remember to take breaks and reach out to your peer support group."
        
    return {"insight": insight}
