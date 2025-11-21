from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.api import deps
from app.crud import acct_pair, acct_nudge

router = APIRouter()

@router.get("/pairs", response_model=List[schemas.AccountabilityPair])
def list_pairs(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    return acct_pair.get_pairs_for_user(db, user_id=current_user.id)

@router.post("/pairs", response_model=schemas.AccountabilityPair)
def create_pair(
    *,
    db: Session = Depends(deps.get_db),
    pair_in: schemas.AccountabilityPairCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    if pair_in.user_b_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot pair with yourself")
    return acct_pair.create_for_user(db, user_a_id=current_user.id, obj_in=pair_in)

@router.get("/pairs/{pair_id}/nudges", response_model=List[schemas.PairNudge])
def list_nudges(
    *,
    db: Session = Depends(deps.get_db),
    pair_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    pairs = acct_pair.get_pairs_for_user(db, user_id=current_user.id)
    if not any(p.id == pair_id for p in pairs):
        raise HTTPException(status_code=403, detail="Not part of this pair")
    return acct_nudge.get_by_pair(db, pair_id=pair_id)

@router.post("/pairs/{pair_id}/nudge", response_model=schemas.PairNudge)
def create_nudge(
    *,
    db: Session = Depends(deps.get_db),
    pair_id: int,
    nudge_in: schemas.PairNudgeCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    pairs = acct_pair.get_pairs_for_user(db, user_id=current_user.id)
    if not any(p.id == pair_id for p in pairs):
        raise HTTPException(status_code=403, detail="Not part of this pair")
    return acct_nudge.create(db, pair_id=pair_id, user_id=current_user.id, obj_in=nudge_in)

@router.get("/suggest-partners", response_model=List[schemas.PartnerSuggestion])
def suggest_partners(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    from app.crud import crud_user, crud_user_settings
    me = crud_user.get_user(db, user_id=current_user.id)
    my_settings = crud_user_settings.get_by_user_id(db, user_id=current_user.id)
    tz = getattr(me, "timezone", "UTC")
    # naive suggestions: same timezone, active, not me
    q = db.query(models.User).filter(models.User.is_active == True).all()
    suggestions = []
    for u in q:
        if u.id == current_user.id:
            continue
        score = 0
        if u.timezone == tz:
            score += 5
        suggestions.append(schemas.PartnerSuggestion(user_id=u.id, full_name=u.full_name, timezone=u.timezone, score=score))
    suggestions.sort(key=lambda s: s.score, reverse=True)
    return suggestions[:10]