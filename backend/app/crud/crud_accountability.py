from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.accountability import AccountabilityPair, PairNudge
from app.schemas.accountability import AccountabilityPairCreate, PairNudgeCreate

class CRUDAcctPair(CRUDBase[AccountabilityPair, AccountabilityPairCreate, AccountabilityPairCreate]):
    def create_for_user(self, db: Session, *, user_a_id: int, obj_in: AccountabilityPairCreate) -> AccountabilityPair:
        db_obj = AccountabilityPair(user_a_id=user_a_id, user_b_id=obj_in.user_b_id, weekly_checkins=obj_in.weekly_checkins)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_pairs_for_user(self, db: Session, *, user_id: int) -> List[AccountabilityPair]:
        return db.query(AccountabilityPair).filter((AccountabilityPair.user_a_id == user_id) | (AccountabilityPair.user_b_id == user_id)).order_by(AccountabilityPair.created_at.desc()).all()

class CRUDAcctNudge:
    def create(self, db: Session, *, pair_id: int, user_id: int, obj_in: PairNudgeCreate) -> PairNudge:
        db_obj = PairNudge(pair_id=pair_id, user_id=user_id, content=obj_in.content)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_pair(self, db: Session, *, pair_id: int, skip: int = 0, limit: int = 100) -> List[PairNudge]:
        return db.query(PairNudge).filter(PairNudge.pair_id == pair_id).order_by(PairNudge.created_at.desc()).offset(skip).limit(limit).all()

acct_pair = CRUDAcctPair(AccountabilityPair)
acct_nudge = CRUDAcctNudge()