
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import crud, models, schemas
from datetime import datetime, timedelta
from app.api import deps

router = APIRouter()

@router.post("/ask", response_model=schemas.ChatMessage)
async def ask_assignwell(
    *,
    db: Session = Depends(deps.get_db),
    message: schemas.ChatMessage,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Chat with AssignWell AI (Therapist-style).
    """
    # Use AIService to generate response
    from app.services.ai_service import ai_service

    # Build rich context from user data
    now = datetime.utcnow()
    upcoming_limit = now + timedelta(days=3)

    assignments = crud.assignment.get_multi_by_owner(db=db, owner_id=current_user.id, limit=30)
    upcoming = []
    overdue_count = 0
    next_item = None
    for a in assignments:
        due = getattr(a, "due_at", None)
        status = (getattr(a, "status", "") or "").upper()
        if not due:
            continue
        try:
            # due may be datetime; ensure comparison in UTC
            due_dt = due if isinstance(due, datetime) else datetime.fromisoformat(str(due))
        except Exception:
            continue
        if due_dt < now and status != "COMPLETED":
            overdue_count += 1
        if now <= due_dt <= upcoming_limit:
            upcoming.append({
                "title": getattr(a, "title", "Untitled"),
                "due_at": due_dt.isoformat(),
                "importance_level": getattr(a, "importance_level", ""),
            })
    if assignments:
        try:
            next_item_obj = min(
                [a for a in assignments if getattr(a, "due_at", None)],
                key=lambda x: getattr(x, "due_at")
            )
            next_item = {
                "title": getattr(next_item_obj, "title", "Untitled"),
                "due_at": getattr(next_item_obj, "due_at").isoformat() if isinstance(getattr(next_item_obj, "due_at"), datetime) else str(getattr(next_item_obj, "due_at"))
            }
        except Exception:
            next_item = None

    moods = crud.mood_checkin.get_multi_by_owner(db=db, owner_id=current_user.id, limit=5)
    mood_history = [
        {
            "mood_valence": getattr(m, "mood_valence", None),
            "energy_level": getattr(m, "energy_level", None),
            "stress_level": getattr(m, "stress_level", None),
            "sleep_hours_last_night": getattr(m, "sleep_hours_last_night", None),
            "created_at": getattr(m, "created_at", None).isoformat() if getattr(m, "created_at", None) else None,
        }
        for m in moods
    ]

    context = {
        "user_name": current_user.full_name,
        "upcoming_assignments": upcoming,
        "overdue_count": overdue_count,
        "next_assignment": next_item,
        "mood_history": mood_history,
    }

    # Try to respond quickly; fallback to quick tip on timeout/errors
    import asyncio
    try:
        response_content = await asyncio.wait_for(
            ai_service.chat_response(message.content, context),
            timeout=4.0
        )
    except asyncio.TimeoutError:
        response_content = ai_service.quick_tip(context)
    except Exception:
        response_content = ai_service.quick_tip(context)
    
    # TODO: Store chat session/message in DB
    
    return {"role": "assistant", "content": response_content}

@router.get("/sessions", response_model=List[schemas.ChatSession])
def read_chat_sessions(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve chat sessions.
    """
    sessions = crud.chat_session.get_multi_by_user(db=db, user_id=current_user.id, skip=skip, limit=limit)
    return sessions
