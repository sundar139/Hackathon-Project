from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

class AccountabilityPairBase(BaseModel):
    user_b_id: int
    weekly_checkins: Optional[int] = 1

class AccountabilityPairCreate(AccountabilityPairBase):
    pass

class AccountabilityPair(AccountabilityPairBase):
    id: int
    user_a_id: int
    active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class PairNudgeBase(BaseModel):
    content: str

class PairNudgeCreate(PairNudgeBase):
    pass

class PairNudge(PairNudgeBase):
    id: int
    pair_id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class PartnerSuggestion(BaseModel):
    user_id: int
    full_name: Optional[str] = None
    timezone: Optional[str] = None
    score: int