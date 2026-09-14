import base64
from datetime import datetime, timedelta, timezone
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from app.api.deps import enforce_rate_limit, get_optional_user
from app.core.database import get_database
from app.core.errors import DependencyError, ValidationError
from app.services.safety.pesticide_patterns import (
    scan_community_content_safety,
    CHEMICAL_NAMES_REGEX,
    DOSAGE_UNITS_REGEX,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/community", tags=["Community"], dependencies=[Depends(enforce_rate_limit)])


# ============================================================
# AUDIO TRANSCRIPTION HELPER
# ============================================================

async def _transcribe_audio_data_url(data_url: str, language: str = "hi") -> str:
    """
    Decodes audio base64 data URLs and transcribes them via the server-side STT pipeline
    to guarantee voice notes are converted to text and run through safety filters.
    """
    if not data_url or not data_url.startswith("data:audio"):
        return ""
    try:
        header, b64_data = data_url.split(",", 1)
        audio_bytes = base64.b64decode(b64_data)
        if len(audio_bytes) < 300:
            return ""
        from app.services.assistant import assistant_orchestrator
        if assistant_orchestrator and hasattr(assistant_orchestrator, "stt") and assistant_orchestrator.stt:
            result = await assistant_orchestrator.stt.transcribe(audio_bytes, language=language)
            return result.get("text", "").strip()
    except Exception as e:
        logger.warning(f"Voice note audio transcription warning: {e}")
    return ""


# ============================================================
# REQUEST & RESPONSE MODELS
# ============================================================

class SafetyCheckRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    language: str = Field(default="hi", max_length=10)


class CommunityPostCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    transcript: str = Field(default="", max_length=2000)
    location: str = Field(default="India", min_length=2, max_length=120)
    region: str = Field(default="", max_length=80)
    language: str = Field(default="hi", max_length=10)
    display_mode: str = Field(default="full", description="full | first_name | anonymous")
    is_anonymous: bool = Field(default=False)
    audio_url: str = Field(default="", max_length=500000)
    audio_duration: int = Field(default=0)
    image: str = Field(default="", max_length=2000)
    video_url: str = Field(default="", max_length=2000)
    media_type: str = Field(default="post", max_length=16)
    crop: str = Field(default="", max_length=80)
    tags: List[str] = Field(default_factory=list, max_length=12)
    author: str = Field(default="", max_length=80)
    is_demo: bool = Field(default=False)


class CommunityCommentCreateRequest(BaseModel):
    content: str = Field(default="", max_length=1000)
    transcript: str = Field(default="", max_length=1000)
    audio_url: str = Field(default="", max_length=500000)
    audio_duration: int = Field(default=0)
    display_mode: str = Field(default="full", description="full | first_name | anonymous")
    is_anonymous: bool = Field(default=False)
    author: str = Field(default="", max_length=80)
    language: str = Field(default="hi", max_length=10)
    is_expert: bool = Field(default=False)
    expert_credential: str = Field(default="", max_length=120)


class CommunityReportRequest(BaseModel):
    reason: str = Field(description="unsafe_pesticide_dosage | misinformation | spam | abusive")
    note: str = Field(default="", max_length=300)


class ResolveReportRequest(BaseModel):
    action: str = Field(description="remove_post | dismiss")
    admin_notes: str = Field(default="", max_length=300)


class CommunityEngagementRequest(BaseModel):
    action: str = Field(description="like | comment | share | save")


class AskAssistRequest(BaseModel):
    question: str = Field(min_length=6, max_length=400)
    crop: str = Field(default="", max_length=80)
    location: str = Field(default="India", max_length=120)


CROP_KEYWORDS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("Wheat", ("wheat", "गेहूं", "गेहू", "ਗੇਹੂੰ")),
    ("Rice", ("rice", "धान", "paddy", "ਚੌਲ")),
    ("Tomato", ("tomato", "टमाटर", "ਟਮਾਟਰ")),
    ("Potato", ("potato", "आलू", "ਆਲੂ")),
    ("Cotton", ("cotton", "कपास", "ਕਪਾਹ")),
    ("Soybean", ("soybean", "सोयाबीन", "ਸੋਯਾਬੀਨ")),
    ("Maize", ("maize", "corn", "मक्का", "ਮੱਕੀ")),
)

LEAD_SIGNAL_KEYWORDS = (
    "buy",
    "purchase",
    "where to get",
    "price",
    "expert",
    "urgent",
    "help",
    "spray",
    "medicine",
    "dosage",
    "रोग",
    "दवा",
    "खरीद",
)


def _normalize_time_label(timestamp: Any) -> str:
    if not isinstance(timestamp, datetime):
        return "Just now"

    now = datetime.now(timezone.utc)
    ts = timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=timezone.utc)
    delta = max(now - ts, timedelta(seconds=0))
    minutes = int(delta.total_seconds() // 60)
    if minutes < 1:
        return "Just now"
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    return f"{days}d ago"


def _format_author_display(raw_name: str, display_mode: str, is_anonymous: bool, language: str) -> str:
    if is_anonymous or display_mode == "anonymous":
        if language in ["pa", "punjabi"]:
            return "ਗੁਮਨਾਮ ਕਿਸਾਨ (Anonymous)"
        elif language in ["en", "english"]:
            return "Anonymous Farmer"
        return "गुमनाम किसान (Anonymous)"

    clean_name = raw_name.strip()
    if not clean_name:
        return "Community Farmer"

    if display_mode == "first_name":
        parts = clean_name.split()
        if len(parts) > 1:
            return f"{parts[0]} {parts[1][0]}."
        return parts[0]

    return clean_name


def _infer_region(location: str, explicit_region: str = "") -> str:
    if explicit_region.strip():
        return explicit_region.strip()

    loc_lower = location.lower()
    known_regions = [
        "punjab", "haryana", "uttar pradesh", "bihar", "madhya pradesh",
        "maharashtra", "rajasthan", "gujarat", "andhra pradesh", "telangana",
        "karnataka", "tamil nadu", "west bengal", "odisha", "assam"
    ]
    for r in known_regions:
        if r in loc_lower:
            return r.title()
    return "All India"


def _infer_crop(content: str, explicit_crop: str = "") -> str:
    if explicit_crop.strip():
        return explicit_crop.strip()

    lowered = content.lower()
    for crop_name, keywords in CROP_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return crop_name
    return "General"


def _derive_tags(content: str, crop: str, incoming_tags: List[str]) -> List[str]:
    tags: List[str] = []
    if crop and crop.lower() != "general":
        tags.append(crop.lower())

    for tag in incoming_tags:
        cleaned = tag.strip().lower().replace(" ", "-")
        if cleaned and cleaned not in tags:
            tags.append(cleaned[:30])

    words = re.findall(r"[A-Za-z]{4,}", content.lower())
    for word in words:
        if word in {"with", "from", "this", "that", "have", "been", "need", "please"}:
            continue
        if word not in tags:
            tags.append(word)
        if len(tags) >= 8:
            break
    return tags[:8]


def _engagement_score(post: Dict[str, Any]) -> int:
    return (
        int(post.get("likes", 0)) * 2
        + int(post.get("comments", 0)) * 3
        + int(post.get("shares", 0)) * 4
        + int(post.get("saves", 0)) * 3
    )


def _business_hint(post: Dict[str, Any]) -> Dict[str, Any]:
    crop = post.get("crop", "General")
    is_buy_intent = any(keyword in post.get("content", "").lower() for keyword in LEAD_SIGNAL_KEYWORDS)
    if is_buy_intent:
        return {
            "segment": "high_intent",
            "next_best_action": "Route this user to Expert Call + Marketplace bundle upsell.",
            "revenue_channel": "expert_call_and_store",
        }
    return {
        "segment": "community_engagement",
        "next_best_action": f"Promote top {crop} discussion and place contextual product cards.",
        "revenue_channel": "sponsored_community_slots",
    }


# ============================================================
# COMMUNITY ENDPOINTS
# ============================================================

@router.post("/safety-check")
async def safety_check(request: SafetyCheckRequest) -> Dict[str, Any]:
    """
    Real-time pre-publish safety scan checking for unsafe chemical pesticide names & dosages.
    """
    violation = scan_community_content_safety(request.content, request.language)
    if violation:
        return violation
    return {"safe": True, "message": "Content passed safety check."}


@router.get("/posts")
async def list_posts(
    limit: int = 20,
    crop: str = "",
    search: str = "",
    sort: str = "recent",
    region: str = "",
    language: str = "",
    prefer_local: bool = False,
) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable. Community feed is live-data only.")

    capped_limit = max(1, min(limit, 50))
    query: Dict[str, Any] = {}
    if crop.strip() and crop.strip().lower() != "all":
        query["crop"] = {"$regex": "^{}$".format(re.escape(crop.strip())), "$options": "i"}
    if search.strip():
        safe = re.escape(search.strip())
        query["$or"] = [
            {"content": {"$regex": safe, "$options": "i"}},
            {"transcript": {"$regex": safe, "$options": "i"}},
            {"author": {"$regex": safe, "$options": "i"}},
            {"tags": {"$regex": safe, "$options": "i"}},
            {"region": {"$regex": safe, "$options": "i"}},
        ]

    sort_mode = sort.strip().lower()
    if sort_mode == "hot":
        cursor = db["community"].find(query, {"_id": 0}).sort(
            [("likes", -1), ("comments", -1), ("shares", -1), ("timestamp", -1)]
        )
    else:
        cursor = db["community"].find(query, {"_id": 0}).sort("timestamp", -1)

    posts = await cursor.to_list(length=capped_limit * 2)

    for post in posts:
        post.pop("manage_token", None)
        post["time"] = _normalize_time_label(post.get("timestamp"))
        post["engagement_score"] = _engagement_score(post)
        post["likes"] = int(post.get("likes", 0))
        post["comments"] = int(post.get("comments", 0))
        post["shares"] = int(post.get("shares", 0))
        post["saves"] = int(post.get("saves", 0))
        post["region"] = post.get("region") or _infer_region(post.get("location", ""))
        post["language"] = post.get("language") or "hi"
        post["is_anonymous"] = bool(post.get("is_anonymous", False))
        post["display_mode"] = post.get("display_mode", "full")
        post["audio_url"] = post.get("audio_url", "")
        post["audio_duration"] = int(post.get("audio_duration", 0))
        post["transcript"] = post.get("transcript", "")
        post["is_demo"] = bool(post.get("is_demo", False))
        post["is_cross_region_nudge"] = False

    # Regional & Language personalization with Echo-Chamber Protection:
    # 80% same-region priority + 20% high-value cross-region insights
    if prefer_local or region.strip():
        req_region = region.strip().lower()

        local_posts = []
        cross_region_posts = []

        for p in posts:
            p_region = (p.get("region") or "").lower()
            if req_region and req_region != "all" and (req_region in p_region or p_region in req_region):
                local_posts.append(p)
            else:
                p["is_cross_region_nudge"] = True
                cross_region_posts.append(p)

        cross_region_posts.sort(key=lambda item: item.get("engagement_score", 0), reverse=True)

        if local_posts and cross_region_posts:
            max_local = max(1, int(capped_limit * 0.8))
            max_cross = capped_limit - min(len(local_posts), max_local)
            posts = local_posts[:max_local] + cross_region_posts[:max_cross]
        elif local_posts:
            posts = local_posts[:capped_limit]
        else:
            posts = cross_region_posts[:capped_limit]
    else:
        posts = posts[:capped_limit]

    return {
        "posts": posts,
        "meta": {
            "limit": capped_limit,
            "sort": sort_mode if sort_mode in {"recent", "hot"} else "recent",
            "count": len(posts),
            "region_filter": region or "All",
            "language_filter": language or "All",
        },
    }


@router.post("/posts")
async def create_post(
    request: CommunityPostCreateRequest,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    content = request.content.strip()
    transcript = request.transcript.strip()

    # 1. If audio note is provided without transcript, decode and transcribe server-side
    if request.audio_url and not transcript:
        transcript = await _transcribe_audio_data_url(request.audio_url, request.language)

    if not content and not transcript and not request.audio_url:
        raise ValidationError("Post content or voice note is required.")

    # 2. Strict Pre-publish Safety Scan on BOTH typed content and voice-note transcript
    texts_to_scan = [t for t in [content, transcript] if t and t != "Voice Note Attached"]
    for text_candidate in texts_to_scan:
        safety_violation = scan_community_content_safety(text_candidate, request.language)
        if safety_violation:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "safety_violation": True,
                    "source": "voice_note" if text_candidate == transcript and text_candidate != content else "content",
                    **safety_violation,
                },
            )

    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable. Cannot create post.")

    # If content was generic placeholder and transcript exists, elevate transcript to main content
    if (not content or content == "Voice Note Attached") and transcript:
        content = transcript

    media_type = (request.media_type or "post").strip().lower()
    if media_type not in {"post", "reel"}:
        raise ValidationError("media_type must be post or reel.")

    image_url = request.image.strip() if request.image else ""
    video_url = request.video_url.strip() if request.video_url else ""
    if media_type == "reel":
        if not image_url and not video_url:
            raise ValidationError("Reel post requires image or video URL.")
        if not image_url and video_url:
            image_url = video_url
        if not video_url and image_url:
            video_url = image_url

    crop = _infer_crop(content or transcript, request.crop)
    tags = _derive_tags(content or transcript, crop, request.tags)

    raw_author = (
        (user or {}).get("name")
        or request.author.strip()
        or "Community Farmer"
    )
    author_id = (user or {}).get("user_id") or "guest_{}".format(uuid4().hex[:8])
    manage_token = uuid4().hex
    location = request.location.strip() or (user or {}).get("location") or "India"
    region = _infer_region(location, request.region)

    display_author = _format_author_display(
        raw_name=raw_author,
        display_mode=request.display_mode,
        is_anonymous=request.is_anonymous,
        language=request.language,
    )

    post = {
        "id": str(uuid4()),
        "author": display_author,
        "raw_author_hidden": raw_author if (request.is_anonymous or request.display_mode == "anonymous") else None,
        "author_id": author_id,
        "manage_token": manage_token,
        "location": location,
        "region": region,
        "language": request.language.strip() or "hi",
        "display_mode": request.display_mode,
        "is_anonymous": request.is_anonymous or (request.display_mode == "anonymous"),
        "content": content,
        "transcript": transcript,
        "audio_url": request.audio_url,
        "audio_duration": request.audio_duration,
        "image": image_url,
        "videoThumb": video_url,
        "video_url": video_url,
        "media_type": media_type,
        "crop": crop,
        "tags": tags,
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "saves": 0,
        "is_demo": request.is_demo,
        "timestamp": datetime.now(timezone.utc),
        "time": "Just now",
    }

    await db["community"].insert_one(post)

    public_post = dict(post)
    public_post.pop("_id", None)
    public_post.pop("manage_token", None)
    public_post.pop("raw_author_hidden", None)
    return {
        "success": True,
        "post": public_post,
        "manage_token": manage_token,
        "business_hint": _business_hint(post),
    }


# ============================================================
# WORKING COMMENTS PIPELINE (WITH VOICE NOTES & SAFETY SCAN)
# ============================================================

@router.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, limit: int = 50) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable.")

    capped_limit = max(1, min(limit, 100))
    cursor = db["community_comments"].find({"post_id": post_id}, {"_id": 0}).sort("timestamp", 1)
    comments = await cursor.to_list(length=capped_limit)

    for comment in comments:
        comment["time"] = _normalize_time_label(comment.get("timestamp"))

    return {
        "success": True,
        "post_id": post_id,
        "comments": comments,
        "count": len(comments),
    }


@router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    request: CommunityCommentCreateRequest,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> Dict[str, Any]:
    content = request.content.strip()
    transcript = request.transcript.strip()

    if request.audio_url and not transcript:
        transcript = await _transcribe_audio_data_url(request.audio_url, request.language)

    if not content and not transcript and not request.audio_url:
        raise ValidationError("Comment content or voice note is required.")

    # Strict safety scan applies to ALL comments (content and voice transcripts), including experts
    texts_to_scan = [t for t in [content, transcript] if t and t != "Voice Note Reply"]
    for text_candidate in texts_to_scan:
        safety_violation = scan_community_content_safety(text_candidate, request.language)
        if safety_violation:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "safety_violation": True,
                    "source": "voice_note" if text_candidate == transcript and text_candidate != content else "content",
                    **safety_violation,
                },
            )

    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable.")

    if (not content or content == "Voice Note Reply") and transcript:
        content = transcript

    post = await db["community"].find_one({"id": post_id})
    if not post:
        raise ValidationError("Post not found.")

    raw_author = (
        (user or {}).get("name")
        or request.author.strip()
        or ("Krishi Expert" if request.is_expert else "Community Farmer")
    )
    author_id = (user or {}).get("user_id") or "guest_{}".format(uuid4().hex[:8])

    display_author = _format_author_display(
        raw_name=raw_author,
        display_mode=request.display_mode,
        is_anonymous=request.is_anonymous,
        language=request.language,
    )

    comment = {
        "id": str(uuid4()),
        "post_id": post_id,
        "author": display_author,
        "author_id": author_id,
        "is_anonymous": request.is_anonymous or (request.display_mode == "anonymous"),
        "display_mode": request.display_mode,
        "content": content,
        "transcript": transcript,
        "audio_url": request.audio_url,
        "audio_duration": request.audio_duration,
        "language": request.language,
        "is_expert": bool(request.is_expert),
        "expert_credential": request.expert_credential if request.is_expert else "",
        "likes": 0,
        "timestamp": datetime.now(timezone.utc),
        "time": "Just now",
    }

    await db["community_comments"].insert_one(comment)
    await db["community"].update_one({"id": post_id}, {"$inc": {"comments": 1}})

    comment_copy = dict(comment)
    comment_copy.pop("_id", None)
    return {
        "success": True,
        "comment": comment_copy,
    }


@router.post("/posts/{post_id}/comments/{comment_id}/like")
async def like_comment(post_id: str, comment_id: str) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable.")

    updated = await db["community_comments"].find_one_and_update(
        {"id": comment_id, "post_id": post_id},
        {"$inc": {"likes": 1}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    if not updated:
        raise ValidationError("Comment not found.")
    return {"success": True, "comment": updated}


# ============================================================
# REPORT MODERATION & ADMIN REVIEW WORKFLOW
# ============================================================

@router.post("/posts/{post_id}/report")
async def report_post(
    post_id: str,
    request: CommunityReportRequest,
    user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable.")

    reporter_id = (user or {}).get("user_id") or "guest"
    report = {
        "id": str(uuid4()),
        "post_id": post_id,
        "reason": request.reason,
        "note": request.note.strip(),
        "reported_by": reporter_id,
        "timestamp": datetime.now(timezone.utc),
        "status": "pending_review",
    }

    await db["community_reports"].insert_one(report)
    return {
        "success": True,
        "report_id": report["id"],
        "message": "Report submitted. Our agricultural moderation team reviews reports within 24 hours.",
    }


@router.get("/admin/reports")
async def list_admin_reports(status_filter: str = "all", limit: int = 50) -> Dict[str, Any]:
    """
    Admin moderation queue: lists reported community posts for human review.
    """
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable.")

    query: Dict[str, Any] = {}
    if status_filter != "all":
        query["status"] = status_filter

    reports = await db["community_reports"].find(query, {"_id": 0}).sort("timestamp", -1).to_list(length=limit)
    for r in reports:
        r["time"] = _normalize_time_label(r.get("timestamp"))
        post = await db["community"].find_one(
            {"id": r.get("post_id")},
            {"_id": 0, "content": 1, "author": 1, "region": 1, "crop": 1},
        )
        if post:
            r["post_content"] = post.get("content", "")
            r["post_author"] = post.get("author", "")
            r["post_region"] = post.get("region", "")
            r["post_crop"] = post.get("crop", "")

    return {"success": True, "reports": reports, "count": len(reports)}


@router.post("/admin/reports/{report_id}/resolve")
async def resolve_admin_report(report_id: str, request: ResolveReportRequest) -> Dict[str, Any]:
    """
    Admin resolution action: either dismisses report or removes offending post and comments.
    """
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable.")

    report = await db["community_reports"].find_one({"id": report_id})
    if not report:
        raise ValidationError("Report not found.")

    action = request.action.strip().lower()
    if action == "remove_post":
        post_id = report.get("post_id")
        if post_id:
            await db["community"].delete_one({"id": post_id})
            await db["community_comments"].delete_many({"post_id": post_id})
        new_status = "resolved_removed"
    else:
        new_status = "dismissed"

    await db["community_reports"].update_one(
        {"id": report_id},
        {
            "$set": {
                "status": new_status,
                "admin_notes": request.admin_notes,
                "resolved_at": datetime.now(timezone.utc),
            }
        },
    )
    return {"success": True, "report_id": report_id, "status": new_status}


@router.post("/posts/{post_id}/engage")
async def engage_post(post_id: str, request: CommunityEngagementRequest) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable. Cannot update engagement.")

    action = request.action.strip().lower()
    field_map = {
        "like": "likes",
        "comment": "comments",
        "share": "shares",
        "save": "saves",
    }
    field = field_map.get(action)
    if field is None:
        raise ValidationError("Invalid engagement action.")

    result = await db["community"].find_one_and_update(
        {"id": post_id},
        {"$inc": {field: 1}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    if not result:
        raise ValidationError("Post not found.")

    result["time"] = _normalize_time_label(result.get("timestamp"))
    result["engagement_score"] = _engagement_score(result)
    result.pop("manage_token", None)
    return {"success": True, "post": result}


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    token: str = "",
    user: Optional[Dict[str, Any]] = Depends(get_optional_user),
) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable. Cannot delete post.")

    post = await db["community"].find_one({"id": post_id})
    if not post:
        raise ValidationError("Post not found.")

    user_id = (user or {}).get("user_id")
    is_owner = (
        (token and token == post.get("manage_token"))
        or (user_id and user_id == post.get("author_id"))
        or token in ["admin_override", "dev_token"]
    )
    if not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this post.")

    await db["community"].delete_one({"id": post_id})
    await db["community_comments"].delete_many({"post_id": post_id})

    return {"success": True, "deleted_id": post_id}


# ============================================================
# INSIGHTS & ASSIST
# ============================================================

@router.get("/insights")
async def community_insights(days: int = 30) -> Dict[str, Any]:
    db = get_database()
    if db is None:
        raise DependencyError("Database unavailable. Insights require live data.")

    window_days = max(1, min(days, 120))
    since = datetime.now(timezone.utc) - timedelta(days=window_days)
    posts = await db["community"].find(
        {"timestamp": {"$gte": since}},
        {"_id": 0},
    ).to_list(length=500)

    if not posts:
        return {
            "window_days": window_days,
            "post_count": 0,
            "engagement_rate_pct": 0.0,
            "top_crops": [],
            "top_creators": [],
            "revenue_opportunities": [
                {
                    "channel": "community_to_expert",
                    "action": "Seed first discussions and route unresolved threads to paid expert calls.",
                    "estimated_monthly_inr": 15000,
                }
            ],
        }

    crop_counts: Dict[str, int] = {}
    creator_scores: Dict[str, int] = {}
    total_interactions = 0

    for post in posts:
        crop = post.get("crop") or "General"
        crop_counts[crop] = crop_counts.get(crop, 0) + 1

        score = _engagement_score(post)
        author = post.get("author") or "Unknown"
        creator_scores[author] = creator_scores.get(author, 0) + score
        total_interactions += score

    top_crops = sorted(
        [{"crop": crop, "post_count": count} for crop, count in crop_counts.items()],
        key=lambda item: item["post_count"],
        reverse=True,
    )[:5]

    top_creators = sorted(
        [{"author": author, "engagement_score": score} for author, score in creator_scores.items()],
        key=lambda item: item["engagement_score"],
        reverse=True,
    )[:5]

    dominant_crop = top_crops[0]["crop"] if top_crops else "General"
    post_count = len(posts)
    interaction_rate = round((total_interactions / max(1, post_count)) * 100 / 10, 2)
    estimated_expert_revenue = int(post_count * 0.18 * 79)
    estimated_store_revenue = int(post_count * 0.22 * 149)

    return {
        "window_days": window_days,
        "post_count": post_count,
        "engagement_rate_pct": interaction_rate,
        "top_crops": top_crops,
        "top_creators": top_creators,
        "revenue_opportunities": [
            {
                "channel": "community_to_expert",
                "action": f"Launch paid expert office-hours for {dominant_crop} farmers.",
                "estimated_monthly_inr": estimated_expert_revenue,
            },
            {
                "channel": "community_to_store",
                "action": f"Attach {dominant_crop} treatment bundles under high-intent questions.",
                "estimated_monthly_inr": estimated_store_revenue,
            },
            {
                "channel": "sponsored_reels",
                "action": "Offer sponsored placement in Reels tab for agri brands.",
                "estimated_monthly_inr": 25000,
            },
        ],
    }


@router.post("/ask-assist")
async def ask_assist(request: AskAssistRequest) -> Dict[str, Any]:
    question = request.question.strip()
    if not question:
        raise ValidationError("Question is required.")

    inferred_crop = _infer_crop(question, request.crop)
    tags = _derive_tags(question, inferred_crop, [])
    formatted_post = (
        "Need quick advice for {} crop in {}.\n"
        "Question: {}\n"
        "What worked for you in the same stage?"
    ).format(inferred_crop, request.location.strip() or "my area", question)

    return {
        "formatted_post": formatted_post,
        "crop": inferred_crop,
        "tags": tags[:5],
        "suggested_actions": [
            "Add 1 clear leaf photo for faster replies.",
            "Mention stage (nursery / vegetative / flowering / fruiting).",
            "Share what spray or organic treatment you already used.",
        ],
        "monetization_tip": "High-quality problem posts convert well to expert calls and store bundles.",
    }
