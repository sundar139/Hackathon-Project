
from typing import List
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.chat import ChatSession, ChatMessage
from app.schemas.chat import ChatSessionCreate, ChatSessionUpdate

class CRUDChatSession(CRUDBase[ChatSession, ChatSessionCreate, ChatSessionUpdate]):
    def create_with_user(
        self, db: Session, *, obj_in: ChatSessionCreate, user_id: int
    ) -> ChatSession:
        obj_in_data = jsonable_encoder(obj_in)
        db_obj = ChatSession(**obj_in_data, user_id=user_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_multi_by_user(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100
    ) -> List[ChatSession]:
        return (
            db.query(self.model)
            .filter(ChatSession.user_id == user_id)
            .offset(skip)
            .limit(limit)
            .all()
        )

chat_session = CRUDChatSession(ChatSession)


class CRUDChatMessage:
    def __init__(self):
        self.model = ChatMessage

    def create_for_session(
        self,
        db: Session,
        *,
        session_id: int,
        user_id: int,
        role: str,
        content: str,
    ) -> ChatMessage:
        db_obj = ChatMessage(session_id=session_id, user_id=user_id, role=role, content=content)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_messages_by_session(
        self,
        db: Session,
        *,
        session_id: int,
        skip: int = 0,
        limit: int = 500,
    ) -> List[ChatMessage]:
        return (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

chat_message = CRUDChatMessage()
