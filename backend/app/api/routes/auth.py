from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.deps import enforce_rate_limit, get_current_user
from app.core.database import get_database
from app.models.schemas import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from app.services.auth import authenticate_user, issue_user_token, register_user

router = APIRouter(prefix="/auth", tags=["Auth"], dependencies=[Depends(enforce_rate_limit)])


from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class SyncUserRequest(BaseModel):
    name: str = Field(default="Kishan Kumar", max_length=100)
    email: Optional[str] = Field(default="", max_length=100)
    phone_number: Optional[str] = Field(default="", max_length=20)
    language: str = Field(default="English", max_length=20)
    auth_provider: str = Field(default="custom", max_length=30)
    firebase_uid: Optional[str] = None


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


@router.post("/sync-user")
async def sync_user(request: SyncUserRequest):
    db = get_database()
    if db is None:
        from app.core.database import init_database
        await init_database()
        db = get_database()

    clean_phone = (request.phone_number or "").replace("+", "").replace(" ", "").replace("-", "")
    clean_name = (request.name or "farmer").lower().replace(" ", "_")
    user_id = request.firebase_uid or (f"usr_{clean_phone}" if clean_phone else f"usr_{clean_name}")
    
    user_doc = {
        "user_id": user_id,
        "name": request.name,
        "email": request.email or "",
        "phone_number": request.phone_number or "",
        "language": request.language,
        "auth_provider": request.auth_provider,
        "role": "farmer",
        "last_active_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    if db is not None:
        try:
            filter_query = {"user_id": user_id}
            if request.email and "@" in request.email:
                filter_query = {"$or": [{"user_id": user_id}, {"email": request.email}]}
            await db["users"].update_one(
                filter_query,
                {"$set": user_doc, "$setOnInsert": {"created_at": datetime.now(timezone.utc), "total_scans": 0}},
                upsert=True,
            )
            print(f"✅ USER PROFILE SYNCED TO MONGODB ATLAS: name={request.name}, email={request.email}, provider={request.auth_provider}")
        except Exception as e:
            print(f"❌ Error syncing user to MongoDB: {e}")

    return {
        "success": True,
        "message": "User profile synced to MongoDB Atlas",
        "user": user_doc
    }


@router.get("/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)) -> UserPublic:
    return UserPublic(
        user_id=user["user_id"],
        name=user["name"],
        phone_number=user["phone_number"],
        role=user.get("role", "farmer"),
        language=user.get("language", "hi"),
        location=user.get("location"),
        soil_type=user.get("soil_type"),
    )
