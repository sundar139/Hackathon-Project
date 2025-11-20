
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.models.chat import RiskFlag

class ChatSessionBase(BaseModel):
    summary: Optional[str] = None
    risk_flag: Optional[RiskFlag] = RiskFlag.NONE

class ChatSessionCreate(ChatSessionBase):
    pass

class ChatSessionUpdate(ChatSessionBase):
    ended_at: Optional[datetime] = None
    summary: Optional[str] = None
    risk_flag: Optional[RiskFlag] = None

class ChatSession(ChatSessionBase):
    id: int
    user_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ChatMessage(BaseModel):
    role: Optional[str] = "user"  # user, assistant
    content: str
    context: Optional[Dict[str, Any]] = None
