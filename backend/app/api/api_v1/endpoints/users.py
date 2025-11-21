
from typing import Any, List
from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.api import deps

router = APIRouter()

@router.post("/", response_model=schemas.User)
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: schemas.UserCreate,
) -> Any:
    """
    Create new user.
    """
    try:
        user = crud.crud_user.get_user_by_email(db, email=user_in.email)
        if user:
            raise HTTPException(
                status_code=400,
                detail="The user with this username already exists in the system.",
            )
        user = crud.crud_user.create_user(db, user=user_in)
        from app.schemas.user_settings import UserSettingsCreate
        settings_in = UserSettingsCreate()
        crud.crud_user_settings.create_with_user(db, obj_in=settings_in, user_id=user.id)
        return user
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me", response_model=schemas.User)
def read_user_me(
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.put("/me", response_model=schemas.User)
def update_user_me(
    *,
    db: Session = Depends(deps.get_db),
    user_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Update current user's profile fields and optionally password.
    """
    try:
        # Prevent email conflicts
        if user_in.email and user_in.email != current_user.email:
            existing = crud.crud_user.get_by_email(db, email=user_in.email)
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
        updated = crud.crud_user.update_user(db, db_obj=current_user, obj_in=user_in)
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/me/change-password")
def change_password(
    *,
    db: Session = Depends(deps.get_db),
    payload: dict = Body(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Change current user's password. Requires current_password and new_password.
    """
    current_password = payload.get("current_password")
    new_password = payload.get("new_password")
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Missing password fields")
    if not crud.crud_user.authenticate(db, email=current_user.email, password=current_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    updated = crud.crud_user.update_user(db, db_obj=current_user, obj_in=schemas.UserUpdate(password=new_password))
    return {"status": "ok", "user_id": updated.id}

@router.put("/me/profile-details")
def update_profile_details(
    *,
    db: Session = Depends(deps.get_db),
    details: dict = Body(...),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Store extended profile details under settings.privacy_preferences.profile_details
    """
    settings = crud.crud_user_settings.get_by_user_id(db, user_id=current_user.id)
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    prefs = settings.notification_preferences or {}
    priv = settings.privacy_preferences or {}
    # Merge profile_details
    existing = priv.get("profile_details") or {}
    priv["profile_details"] = {**existing, **details}
    update_in = {
        "privacy_preferences": priv,
        "notification_preferences": prefs,
    }
    settings = crud.crud_user_settings.update_settings(db, db_obj=settings, obj_in=update_in)  # type: ignore
    return {"status": "ok"}

@router.post("/me/deactivate")
def deactivate_account(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    current_user.is_active = False
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {"status": "deactivated"}

@router.delete("/me")
def delete_account(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    try:
        db.delete(current_user)
        db.commit()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me/settings", response_model=schemas.UserSettings)
def read_user_settings(
    db: Session = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user settings.
    """
    settings = crud.crud_user_settings.get_by_user_id(db, user_id=current_user.id)
    if not settings:
        # Create default settings if they don't exist
        settings_in = schemas.UserSettingsCreate(
            max_daily_study_hours=8,
            preferred_study_blocks={"morning": True, "afternoon": True, "evening": False},
            notification_preferences={"email": True, "push": True},
            privacy_preferences={"share_data": False},
            wellbeing_settings={"checkin_frequency": "daily"}
        )
        settings = crud.crud_user_settings.create_with_user(db, obj_in=settings_in, user_id=current_user.id)
    return settings

@router.put("/me/settings", response_model=schemas.UserSettings)
def update_user_settings(
    *,
    db: Session = Depends(deps.get_db),
    settings_in: schemas.UserSettingsUpdate,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """
    Update current user settings.
    """
    settings = crud.crud_user_settings.get_by_user_id(db, user_id=current_user.id)
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    settings = crud.crud_user_settings.update_settings(db, db_obj=settings, obj_in=settings_in)
    return settings
