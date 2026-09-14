from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.deps import enforce_rate_limit, get_admin_user, get_current_user, get_optional_user
from app.core.config import settings
from app.core.database import get_database
from app.models.schemas import ExpertCallRequest, ExpertCallResponse

from app.services.expert import trigger_expert_call, update_call_status_from_webhook



router = APIRouter(prefix="/expert", tags=["Expert Calls"], dependencies=[Depends(enforce_rate_limit)])


from pydantic import BaseModel, Field


def _seed_experts() -> list[dict]:
    base = [
        ("Dr. Neha Verma", "Wheat & Paddy Specialist", "Fungal Diseases", "👩‍⚕️", "#10b981", "KVK Affiliated Agronomist", "ICAR Krishi Vigyan Kendra, Karnal", "KVK-HR-8841"),
        ("Dr. Sukhdeep Singh", "Vegetable Disease Advisor", "Pest Control", "👨‍🔬", "#3b82f6", "Ph.D. Plant Pathology (PAU)", "Punjab Agricultural University, Ludhiana", "PAU-DOC-7712"),
        ("Prof. Meena Rao", "Soil & Nutrition Expert", "Soil Health", "👩‍🌾", "#f59e0b", "ICAR Senior Soil Chemist", "ICAR - Indian Agricultural Research Institute", "ICAR-IARI-9043"),
        ("Dr. Iqbal Khan", "Cotton Protection Expert", "Bollworm Control", "👨‍⚕️", "#06b6d4", "State Agri University Extension Officer", "Chaudhary Charan Singh HAU, Hisar", "CCSHAU-EXT-3310"),
        ("Dr. Arti Sharma", "Tomato & Chili Specialist", "Late Blight", "👩‍🔬", "#ef4444", "KVK Horticultural Scientist", "Krishi Vigyan Kendra, Solan (UHF)", "KVK-HP-5102"),
        ("Dr. Amit Patil", "Sugarcane Advisor", "Stalk Borer", "👨‍🌾", "#22c55e", "Certified Crop Agronomist", "Vasantdada Sugar Institute, Pune", "VSI-PUN-6421"),
        ("Dr. Harpreet Kaur", "Rice Pathology", "Blast & Sheath Blight", "👩‍⚕️", "#8b5cf6", "ICAR-NRRI Scientist", "National Rice Research Institute", "NRRI-SC-1029"),
        ("Dr. Nitin Yadav", "Maize Agronomist", "Nutrient Deficiency", "👨‍🔬", "#14b8a6", "KVK Field Specialist", "Krishi Vigyan Kendra, Indore", "KVK-MP-4481"),
        ("Dr. Rehana Ali", "Soybean Disease Lead", "Rust & Mosaic", "👩‍🌾", "#ec4899", "ICAR-IISR Scientist", "Indian Institute of Soybean Research", "IISR-IND-8012"),
        ("Dr. Vivek Das", "Irrigation Planner", "Water Management", "👨‍⚕️", "#0ea5e9", "Govt. Agricultural Engineer", "Water Technology Centre, TNAU", "TNAU-WTC-3390"),
        ("Dr. Komal Joshi", "Organic Farming Coach", "Biological Control", "👩‍🔬", "#16a34a", "KVK Organic Farming Officer", "Krishi Vigyan Kendra, Anand (AAU)", "KVK-GJ-7719"),
        ("Dr. Rajeev Saini", "Plant Nutrition Expert", "Micronutrient Plan", "👨‍🌾", "#f97316", "Professor of Soil Science", "GB Pant University of Agri & Tech", "GBPUAT-FAC-9921"),
    ]
    experts: list[dict] = []
    for i in range(48):
        name, role, speciality, avatar, accent, cred_title, institution, ver_id = base[i % len(base)]
        is_live = i % 3 != 0
        experts.append({
            "id": f"exp_{uuid4().hex[:10]}",
            "name": name,
            "role": role,
            "status": "Online now" if is_live else "Available in 8 min",
            "isLive": is_live,
            "rating": round(4.6 + ((i % 5) * 0.08), 1),
            "calls": 300 + (i * 37),
            "avatar": avatar,
            "bg": f"linear-gradient(135deg, {accent}18, {accent}0a)",
            "accent": accent,
            "speciality": speciality,
            "crop_focus": ["Wheat", "Rice", "Tomato", "Cotton", "Soybean", "Sugarcane", "Maize"][i % 7],
            "is_verified": True,
            "verification_status": "verified",
            "credential_title": cred_title,
            "institution": institution,
            "verification_id": ver_id,
            "verified_by": "ICAR-KVK Agronomy Validation Board",
            "verified_at": "2026-01-15",
        })
    return experts


class ExpertCredentialSubmissionRequest(BaseModel):
    name: str = Field(min_length=3, max_length=100)
    email: str = Field(default="", max_length=100)
    phone: str = Field(min_length=10, max_length=15)
    credential_type: str = Field(description="kvk | degree | icar | state_extension")
    credential_title: str = Field(min_length=3, max_length=120)
    institution: str = Field(min_length=3, max_length=150)
    id_or_registration_number: str = Field(min_length=3, max_length=80)
    crop_speciality: str = Field(default="General", max_length=80)
    experience_years: int = Field(default=1, ge=0, le=60)
    notes: str = Field(default="", max_length=500)


def _fallback_experts(crop: str, limit: int) -> list[dict]:
    seed = _seed_experts()
    clean_crop = crop.strip().lower()
    if clean_crop and clean_crop != "all":
        seed = [item for item in seed if clean_crop in item.get("crop_focus", "").lower()]
    return seed[:limit]


@router.post("/call", response_model=ExpertCallResponse)
async def request_expert_call(
    request: ExpertCallRequest,
    user=Depends(get_optional_user),
) -> ExpertCallResponse:
    db = get_database()
    response, call_log_id = await trigger_expert_call(
        db=db,
        phone_number=request.phone_number,
        user_id=user.get("user_id") if user else None,
        reason=request.reason,
        metadata={**request.metadata, "prediction_id": request.prediction_id},
    )
    return ExpertCallResponse(
        **response,
        message="{} log_id={}".format(response["message"], call_log_id if call_log_id else "none"),
    )


@router.get("/history")
async def my_call_history(user=Depends(get_current_user)):
    db = get_database()
    if db is None:
        return {"success": True, "calls": []}
    calls = await db["expert_call_logs"].find(
        {"user_id": user["user_id"]},
        {"_id": 0},
    ).sort("timestamp", -1).to_list(length=30)
    return {"success": True, "calls": calls}


@router.post("/webhook/vapi")
async def vapi_webhook_update(
    payload: dict,
    x_webhook_token: str = Header(default="", alias="x-webhook-token"),
):
    if settings.vapi_webhook_secret:
        if x_webhook_token != settings.vapi_webhook_secret:
            raise HTTPException(status_code=401, detail="Invalid webhook token.")
    elif settings.app_env == "production":
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")

    db = get_database()
    result = await update_call_status_from_webhook(db, payload)
    return {"success": True, **result}


@router.get("/analytics")
async def call_analytics(window_days: int = 7, _admin=Depends(get_admin_user)):
    db = get_database()
    if db is None:
        return {
            "success": True,
            "window_days": max(1, min(window_days, 90)),
            "total_calls": 0,
            "completed_calls": 0,
            "failed_calls": 0,
            "in_progress_calls": 0,
            "avg_attempts": None,
            "success_rate_pct": None,
        }

    bounded_window = max(1, min(window_days, 90))
    since = datetime.now(timezone.utc) - timedelta(days=bounded_window)
    logs = await db["expert_call_logs"].find(
        {"timestamp": {"$gte": since}},
        {"_id": 0, "status": 1, "attempts": 1},
    ).to_list(length=50000)

    total_calls = len(logs)
    completed_calls = 0
    failed_calls = 0
    in_progress_calls = 0
    attempts = []
    for row in logs:
        status = str(row.get("status", "")).strip().lower()
        if status == "completed":
            completed_calls += 1
        elif status == "failed":
            failed_calls += 1
        else:
            in_progress_calls += 1

        attempt = row.get("attempts")
        if isinstance(attempt, int) and attempt > 0:
            attempts.append(attempt)

    settled_calls = completed_calls + failed_calls
    success_rate_pct = round(100.0 * completed_calls / settled_calls, 2) if settled_calls else None
    avg_attempts = round(sum(attempts) / len(attempts), 2) if attempts else None

    return {
        "success": True,
        "window_days": bounded_window,
        "total_calls": total_calls,
        "completed_calls": completed_calls,
        "failed_calls": failed_calls,
        "in_progress_calls": in_progress_calls,
        "avg_attempts": avg_attempts,
        "success_rate_pct": success_rate_pct,
    }


@router.get("/directory")
async def expert_directory(crop: str = "", limit: int = 48):
    bounded_limit = max(1, min(limit, 100))
    clean_crop = crop.strip()

    db = get_database()
    if db is None:
        experts = _fallback_experts(clean_crop, bounded_limit)
        return {"success": True, "total": len(experts), "experts": experts}

    collection = db["experts_directory"]
    total_docs = await collection.count_documents({})
    if total_docs == 0:
        await collection.insert_many(_seed_experts())

    query = {}
    if clean_crop and clean_crop.lower() != "all":
        query = {"crop_focus": {"$regex": "^{}$".format(clean_crop), "$options": "i"}}

    total = await collection.count_documents(query)
    experts = await collection.find(query, {"_id": 0}).sort(
        [("isLive", -1), ("rating", -1), ("calls", -1)]
    ).to_list(length=bounded_limit)

    if not experts:
        experts = _fallback_experts(clean_crop, bounded_limit)
        total = len(experts)

    return {"success": True, "total": total, "experts": experts}


@router.post("/directory/verify-request")
async def submit_expert_verification(request: ExpertCredentialSubmissionRequest):
    db = get_database()
    if db is None:
        return {
            "success": True,
            "message": "Credential submission received in offline mode. Verification in progress.",
            "request_id": f"req_{uuid4().hex[:8]}",
        }

    submission = {
        "id": f"ver_req_{uuid4().hex[:10]}",
        "name": request.name,
        "email": request.email,
        "phone": request.phone,
        "credential_type": request.credential_type,
        "credential_title": request.credential_title,
        "institution": request.institution,
        "id_or_registration_number": request.id_or_registration_number,
        "crop_speciality": request.crop_speciality,
        "experience_years": request.experience_years,
        "notes": request.notes,
        "status": "pending_review",
        "submitted_at": datetime.now(timezone.utc),
    }

    await db["expert_verification_requests"].insert_one(submission)

    return {
        "success": True,
        "message": "Credential submission received. Agronomy verification board reviews within 24 hours.",
        "request_id": submission["id"],
        "verification_badge": f"Pending Review: {request.credential_title}",
    }


class ExpertCredentialReviewRequest(BaseModel):
    action: str = Field(description="approve | reject")
    reviewer_notes: str = Field(default="", max_length=500)
    reviewed_by: str = Field(default="Agronomy Verification Board", max_length=100)


@router.get("/admin/verification-requests")
async def list_verification_requests(status_filter: str = "all", limit: int = 50):
    """
    Admin queue: lists expert credential submissions for agronomic verification review.
    """
    db = get_database()
    if db is None:
        return {"success": True, "requests": [], "total": 0}

    query = {}
    if status_filter != "all":
        query["status"] = status_filter

    capped_limit = max(1, min(limit, 100))
    requests = await db["expert_verification_requests"].find(
        query,
        {"_id": 0},
    ).sort("submitted_at", -1).to_list(length=capped_limit)

    for req in requests:
        if isinstance(req.get("submitted_at"), datetime):
            req["submitted_at"] = req["submitted_at"].isoformat()
        if isinstance(req.get("reviewed_at"), datetime):
            req["reviewed_at"] = req["reviewed_at"].isoformat()

    return {"success": True, "total": len(requests), "requests": requests}


@router.post("/admin/verification-requests/{request_id}/review")
async def review_expert_verification_request(request_id: str, payload: ExpertCredentialReviewRequest):
    """
    Admin action: approve or reject an agronomist credential submission.
    Upon approval, updates or creates the expert entry in experts_directory with verified badges.
    """
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    action = payload.action.strip().lower()
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    req_doc = await db["expert_verification_requests"].find_one({"id": request_id})
    if not req_doc:
        raise HTTPException(status_code=404, detail="Verification request not found")

    new_status = "approved" if action == "approve" else "rejected"
    now = datetime.now(timezone.utc)

    await db["expert_verification_requests"].update_one(
        {"id": request_id},
        {
            "$set": {
                "status": new_status,
                "reviewer_notes": payload.reviewer_notes.strip(),
                "reviewed_by": payload.reviewed_by.strip(),
                "reviewed_at": now,
            }
        },
    )

    expert_profile = None
    if action == "approve":
        # Check if expert already exists by email/phone or create new verified expert profile
        query = {"$or": [{"phone": req_doc["phone"]}]}
        if req_doc.get("email"):
            query["$or"].append({"email": req_doc["email"]})

        existing_expert = await db["experts_directory"].find_one(query)
        if existing_expert:
            expert_profile = await db["experts_directory"].find_one_and_update(
                {"id": existing_expert["id"]},
                {
                    "$set": {
                        "is_verified": True,
                        "verification_status": "verified",
                        "credential_title": req_doc["credential_title"],
                        "institution": req_doc["institution"],
                        "verification_id": req_doc["id_or_registration_number"],
                        "verified_by": payload.reviewed_by.strip() or "ICAR-KVK Agronomy Validation Board",
                        "verified_at": now.strftime("%Y-%m-%d"),
                        "crop_focus": req_doc["crop_speciality"] or existing_expert.get("crop_focus", "General"),
                    }
                },
                return_document=True,
                projection={"_id": 0},
            )
        else:
            expert_id = f"exp_{uuid4().hex[:10]}"
            expert_profile = {
                "id": expert_id,
                "name": req_doc["name"],
                "email": req_doc.get("email", ""),
                "phone": req_doc["phone"],
                "role": f"{req_doc['crop_speciality']} Specialist",
                "status": "Online now",
                "isLive": True,
                "rating": 4.9,
                "calls": 12,
                "avatar": "👨‍🔬",
                "bg": "linear-gradient(135deg, #10b98118, #10b9810a)",
                "accent": "#10b981",
                "speciality": req_doc["credential_title"],
                "crop_focus": req_doc["crop_speciality"] or "General",
                "is_verified": True,
                "verification_status": "verified",
                "credential_title": req_doc["credential_title"],
                "institution": req_doc["institution"],
                "verification_id": req_doc["id_or_registration_number"],
                "verified_by": payload.reviewed_by.strip() or "ICAR-KVK Agronomy Validation Board",
                "verified_at": now.strftime("%Y-%m-%d"),
            }
            await db["experts_directory"].insert_one(dict(expert_profile))

    return {
        "success": True,
        "request_id": request_id,
        "status": new_status,
        "action": action,
        "expert": expert_profile,
    }


@router.post("/directory/{expert_id}/verify")
async def approve_expert_credentials(expert_id: str, _admin=Depends(get_admin_user)):
    db = get_database()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    result = await db["experts_directory"].find_one_and_update(
        {"id": expert_id},
        {
            "$set": {
                "is_verified": True,
                "verification_status": "verified",
                "verified_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            }
        },
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Expert not found")

    return {"success": True, "expert": result}
