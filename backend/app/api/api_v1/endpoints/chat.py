
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

    # Get or create an active chat session for the user (tolerate DB errors)
    active_session = None
    try:
        active_session = (
            db.query(models.ChatSession)
            .filter(models.ChatSession.user_id == current_user.id)
            .filter(models.ChatSession.ended_at.is_(None))
            .first()
        )
        if not active_session:
            active_session = crud.chat_session.create_with_user(db=db, obj_in=schemas.ChatSessionCreate(), user_id=current_user.id)
    except Exception:
        active_session = None

    # Save the user's message (best-effort)
    try:
        if active_session:
            crud.chat_message.create_for_session(
                db,
                session_id=active_session.id,
                user_id=current_user.id,
                role="user",
                content=message.content,
            )
    except Exception:
        pass

    # Try to respond quickly; fallback to quick tip on timeout/errors
    import asyncio
    try:
        response_content = await asyncio.wait_for(
            ai_service.chat_response(message.content, context),
            timeout=2.0
        )
    except asyncio.TimeoutError:
        response_content = ai_service.quick_tip(context)
    except Exception:
        response_content = ai_service.quick_tip(context)

    # Save the assistant's message (best-effort)
    try:
        if active_session:
            crud.chat_message.create_for_session(
                db,
                session_id=active_session.id,
                user_id=current_user.id,
                role="assistant",
                content=response_content,
            )
    except Exception:
        pass

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


@router.get("/sessions/{session_id}/messages", response_model=List[schemas.ChatMessage])
def read_chat_session_messages(
    *,
    db: Session = Depends(deps.get_db),
    session_id: int,
    skip: int = 0,
    limit: int = 500,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve messages for a chat session owned by the current user.
    """
    session = crud.chat_session.get(db, id=session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = crud.chat_message.get_messages_by_session(db=db, session_id=session_id, skip=skip, limit=limit)
    # Map ORM to simple schema dicts
    return [{"role": m.role, "content": m.content} for m in messages]


@router.post("/sessions/{session_id}/end")
def end_chat_session(
    *,
    db: Session = Depends(deps.get_db),
    session_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    End an active chat session.
    """
    session = crud.chat_session.get(db, id=session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        from datetime import datetime, timezone
        crud.chat_session.update(db, db_obj=session, obj_in={"ended_at": datetime.now(timezone.utc)})
        return {"status": "ended"}
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to end session")
