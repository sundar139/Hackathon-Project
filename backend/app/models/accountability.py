from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class AccountabilityPair(Base):
    __tablename__ = "accountability_pairs"

    id = Column(Integer, primary_key=True, index=True)
    user_a_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_b_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    weekly_checkins = Column(Integer, default=1)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user_a = relationship("User", foreign_keys=[user_a_id])
    user_b = relationship("User", foreign_keys=[user_b_id])

class PairNudge(Base):
    __tablename__ = "pair_nudges"

    id = Column(Integer, primary_key=True, index=True)
    pair_id = Column(Integer, ForeignKey("accountability_pairs.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    pair = relationship("AccountabilityPair")
    user = relationship("User")