
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import crud, models, schemas
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
    
    # In a real implementation, we would retrieve context here
    context = {"user_name": current_user.full_name}
    
    response_content = await ai_service.chat_response(message.content, context)
    
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
