
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
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
    role: str # user, assistant
    content: str
