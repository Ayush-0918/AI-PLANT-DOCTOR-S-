from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.deps import enforce_rate_limit, get_current_user
from app.core.database import get_database
from app.models.schemas import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.services.auth import authenticate_user, issue_user_token, register_user

router = APIRouter(prefix="/auth", tags=["Auth"], dependencies=[Depends(enforce_rate_limit)])


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest) -> TokenResponse:
    db = get_database()
    user = await register_user(
        db=db,
        name=request.name,
        phone_number=request.phone_number,
        password=request.password,
        language=request.language,
        location=request.location,
    )

    user_doc = {
        "user_id": user.user_id,
        "name": user.name,
        "phone_number": user.phone_number,
        "role": user.role,
        "language": user.language,
        "location": user.location,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return issue_user_token(user_doc)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest) -> TokenResponse:
    db = get_database()
    user_doc = await authenticate_user(
        db=db,
        phone_number=request.phone_number,
        password=request.password,
    )
    return issue_user_token(user_doc)


from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class SyncUserRequest(BaseModel):
    name: str = Field(default="Farmer", min_length=1, max_length=100)
    email: Optional[str] = Field(default="", max_length=100)
    phone_number: Optional[str] = Field(default="", max_length=20)
    auth_provider: Optional[str] = Field(default="email", max_length=50)
    firebase_uid: Optional[str] = Field(default="", max_length=120)
    language: Optional[str] = Field(default="Hindi", max_length=50)
    location: Optional[Dict[str, Any]] = None

@router.post("/sync-user")
async def sync_user(request: SyncUserRequest):
    db = get_database()
    if db is None:
        from app.core.database import init_database
        await init_database()
        db = get_database()

    user_id = request.firebase_uid or request.email or request.phone_number or f"user_{request.name.lower().replace(' ', '_')}"
    user_doc = {
        "user_id": user_id,
        "name": request.name,
        "email": request.email,
        "phone_number": request.phone_number,
        "auth_provider": request.auth_provider,
        "language": request.language,
        "location": request.location,
        "last_active_at": datetime.now(timezone.utc),
    }

    if db is not None:
        await db["users"].update_one(
            {"user_id": user_id},
            {
                "$set": user_doc,
                "$setOnInsert": {"created_at": datetime.now(timezone.utc), "total_scans": 0}
            },
            upsert=True
        )
        print(f"✅ USER PROFILE SYNCED TO MONGODB ATLAS: name={request.name}, email={request.email}, provider={request.auth_provider}")
        return {"success": True, "message": "User profile synced to MongoDB Atlas", "user": user_doc}

    return {"success": False, "message": "Database instance uninitialized"}
