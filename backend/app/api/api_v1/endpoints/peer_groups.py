
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps
from sqlalchemy import func

router = APIRouter()

@router.get("/", response_model=List[schemas.PeerGroup])
def read_peer_groups(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve peer groups.
    """
    groups = crud.peer_group.get_multi(db, skip=skip, limit=limit)
    for group in groups:
        group.member_count = len(group.members)
        group.is_member = crud.peer_group.is_member(db=db, group_id=group.id, user_id=current_user.id)
    return groups

@router.get("/{group_id}", response_model=schemas.PeerGroup)
def read_peer_group(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    group = crud.peer_group.get(db=db, id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group.member_count = len(group.members)
    group.is_member = crud.peer_group.is_member(db=db, group_id=group_id, user_id=current_user.id)
    return group

@router.post("/", response_model=schemas.PeerGroup)
def create_peer_group(
    *,
    db: Session = Depends(deps.get_db),
    group_in: schemas.PeerGroupCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Create new peer group.
    """
    group = crud.peer_group.create(db=db, obj_in=group_in)
    # Auto-join creator
    crud.peer_group.join_group(db=db, group_id=group.id, user_id=current_user.id)
    return group

@router.post("/{group_id}/join", response_model=schemas.GroupMember)
def join_peer_group(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Join a peer group.
    """
    group = crud.peer_group.get(db=db, id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if crud.peer_group.is_member(db=db, group_id=group_id, user_id=current_user.id):
         raise HTTPException(status_code=400, detail="Already a member")

    member = crud.peer_group.join_group(db=db, group_id=group_id, user_id=current_user.id)
    return member

@router.delete("/{group_id}/leave", response_model=schemas.GroupMember)
def leave_peer_group(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    group = crud.peer_group.get(db=db, id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    member = crud.peer_group.leave_group(db=db, group_id=group_id, user_id=current_user.id)
    if not member:
        raise HTTPException(status_code=400, detail="Not a member")
    return member

@router.get("/{group_id}/members", response_model=List[schemas.GroupMember])
def read_members(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    group = crud.peer_group.get(db=db, id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not crud.peer_group.is_member(db=db, group_id=group_id, user_id=current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    members = crud.peer_group.get_members(db=db, group_id=group_id, skip=skip, limit=limit)
    return members

@router.get("/recommendations", response_model=List[schemas.PeerGroup])
def recommend_peer_groups(
    *,
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 10,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    groups = crud.peer_group.get_multi(db, skip=0, limit=1000)
    courses = []
    try:
        from app.crud import crud_assignment as asg
        courses = asg.get_courses(db, user_id=current_user.id, skip=0, limit=100)
    except Exception:
        courses = []
    course_keywords = []
    for c in courses:
        if getattr(c, "name", None):
            course_keywords.append(c.name.lower())
        if getattr(c, "code", None) and c.code:
            course_keywords.append(str(c.code).lower())
    scored = []
    for g in groups:
        g.member_count = len(g.members)
        g.is_member = crud.peer_group.is_member(db=db, group_id=g.id, user_id=current_user.id)
        text = (g.name or "") + " " + (g.description or "")
        tl = text.lower()
        match_score = 0
        for kw in course_keywords:
            if kw and kw in tl:
                match_score += 3
        popularity = g.member_count or 0
        membership_bonus = 5 if g.is_member else 0
        score = match_score + popularity + membership_bonus
        scored.append((score, g))
    scored.sort(key=lambda x: x[0], reverse=True)
    result = [g for _, g in scored[skip:skip+limit]]
    return result

@router.post("/{group_id}/nudge", response_model=schemas.GroupMessage)
def nudge_group(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    group = crud.peer_group.get(db=db, id=group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not crud.peer_group.is_member(db=db, group_id=group_id, user_id=current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this group")
    content = "Nudge: Keep going! Small steps add up."
    message = crud.peer_group.create_message(db=db, group_id=group_id, user_id=current_user.id, content=content)
    return message

@router.get("/{group_id}/messages", response_model=List[schemas.GroupMessage])
def read_messages(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Retrieve messages for a peer group.
    """
    if not crud.peer_group.is_member(db=db, group_id=group_id, user_id=current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this group")
        
    messages = crud.peer_group.get_messages(db=db, group_id=group_id, skip=skip, limit=limit)
    return messages

@router.post("/{group_id}/messages", response_model=schemas.GroupMessage)
def create_message(
    *,
    db: Session = Depends(deps.get_db),
    group_id: int,
    message_in: schemas.GroupMessageCreate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Post a message to a peer group.
    """
    if not crud.peer_group.is_member(db=db, group_id=group_id, user_id=current_user.id):
        raise HTTPException(status_code=403, detail="Not a member of this group")
        
    message = crud.peer_group.create_message(
        db=db, group_id=group_id, user_id=current_user.id, content=message_in.content
    )
    return message
