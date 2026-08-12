"""Community activity → bell + email (follow, comment, like batch, repost, mention)."""
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import get_user_id
from app.core.config import settings
from app.core.supabase import service_supabase
from app.core.users import user_full_name
from app.services.notification_service import notify

router = APIRouter(prefix="/api/notify", tags=["community-notifications"])

LIKE_BATCH_WINDOW_SECONDS = 3600  # 1 hour


def _profile_name(user_id: str) -> str:
    return user_full_name(user_id) or "Someone"


class FollowNotifyIn(BaseModel):
    receiver_id: str


class PostActivityIn(BaseModel):
    receiver_id: str
    post_id: str
    preview: str = Field(default="", max_length=200)


class LikeBatchIn(BaseModel):
    receiver_id: str
    post_id: str
    like_count: int = Field(ge=1, le=9999)


class MentionIn(BaseModel):
    receiver_id: str
    post_id: str
    preview: str = Field(default="", max_length=200)


@router.post("/community/follow")
async def notify_follow(payload: FollowNotifyIn, actor_id: str = Depends(get_user_id)):
    if payload.receiver_id == actor_id:
        return {"sent": False}
    name = _profile_name(actor_id)
    notify(
        payload.receiver_id,
        "community_follow",
        f"{name} started following you",
        f"{name} started following you on FounderHub.",
        {"follower_id": actor_id},
        template="community_follow",
        template_data={
            "from_name": name,
            "action_url": settings.frontend_url_for(f"/profile/{actor_id}"),
            "action_label": "View Profile",
        },
        dedupe_key=f"follow:{actor_id}:{payload.receiver_id}",
    )
    return {"sent": True}


@router.post("/community/comment")
async def notify_comment(payload: PostActivityIn, actor_id: str = Depends(get_user_id)):
    if payload.receiver_id == actor_id:
        return {"sent": False}
    name = _profile_name(actor_id)
    notify(
        payload.receiver_id,
        "community_comment",
        f"{name} commented on your post",
        (payload.preview or "New comment")[:120],
        {"post_id": payload.post_id, "commenter_id": actor_id},
        template="community_comment",
        template_data={
            "from_name": name,
            "preview": payload.preview[:120],
            "action_url": settings.frontend_url_for(f"/community?post={payload.post_id}"),
            "action_label": "View Post",
        },
        dedupe_key=f"comment:{payload.post_id}:{actor_id}:{payload.receiver_id}",
    )
    return {"sent": True}


@router.post("/community/repost")
async def notify_repost(payload: PostActivityIn, actor_id: str = Depends(get_user_id)):
    if payload.receiver_id == actor_id:
        return {"sent": False}
    name = _profile_name(actor_id)
    notify(
        payload.receiver_id,
        "community_repost",
        f"{name} reposted your post",
        "Your post was shared again on FounderHub.",
        {"post_id": payload.post_id, "reposter_id": actor_id},
        template="community_repost",
        template_data={
            "from_name": name,
            "action_url": settings.frontend_url_for(f"/community?post={payload.post_id}"),
            "action_label": "View Post",
        },
        dedupe_key=f"repost:{payload.post_id}:{actor_id}:{payload.receiver_id}",
    )
    return {"sent": True}


@router.post("/community/likes")
async def notify_likes_batch(payload: LikeBatchIn, actor_id: str = Depends(get_user_id)):
    """Aggregated likes — one email per post per hour, not one per like."""
    if payload.receiver_id == actor_id:
        return {"sent": False}
    bucket = int(time.time() // LIKE_BATCH_WINDOW_SECONDS)
    count = payload.like_count
    notify(
        payload.receiver_id,
        "community_likes",
        f"{count} new likes on your post",
        f"Your post received {count} new likes on FounderHub.",
        {"post_id": payload.post_id, "like_count": count},
        template="community_likes",
        template_data={
            "like_count": count,
            "action_url": settings.frontend_url_for(f"/community?post={payload.post_id}"),
            "action_label": "View Post",
        },
        dedupe_key=f"likes:{payload.post_id}:{payload.receiver_id}:{bucket}",
    )
    return {"sent": True}


@router.post("/community/mention")
async def notify_mention(payload: MentionIn, actor_id: str = Depends(get_user_id)):
    if payload.receiver_id == actor_id:
        return {"sent": False}
    name = _profile_name(actor_id)
    notify(
        payload.receiver_id,
        "community_mention",
        f"{name} mentioned you",
        (payload.preview or "You were mentioned")[:120],
        {"post_id": payload.post_id, "mentioner_id": actor_id},
        template="community_mention",
        template_data={
            "from_name": name,
            "preview": payload.preview[:120],
            "action_url": settings.frontend_url_for(f"/community?post={payload.post_id}"),
            "action_label": "View Post",
        },
        dedupe_key=f"mention:{payload.post_id}:{actor_id}:{payload.receiver_id}",
    )
    return {"sent": True}


class WaitlistSignupIn(BaseModel):
    email: str
    country: str = ""
    city: str = ""


@router.post("/waitlist-signup")
async def notify_waitlist_signup(payload: WaitlistSignupIn):
    """Public endpoint — notify admins + optional confirmation to signup."""
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")

    from app.services.notification_service import notify_admin

    notify_admin(
        "New FounderHub waitlist signup",
        f"{email} joined from {payload.country or 'unknown'}",
        {"email": email, "country": payload.country, "city": payload.city},
        template="waitlist_admin",
        template_data={
            "email": email,
            "country": payload.country,
            "city": payload.city,
        },
        dedupe_key=f"waitlist_admin:{email}",
    )

    from app.services.email_queue_service import enqueue_email

    enqueue_email(
        email,
        "waitlist_confirmation",
        template="waitlist_confirmation",
        data={"user_name": email.split("@")[0], "email": email},
        dedupe_key=f"waitlist_confirm:{email}",
    )
    return {"sent": True}
