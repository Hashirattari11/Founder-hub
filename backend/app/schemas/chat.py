from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class ChatStartIn(BaseModel):
    receiver_id: str


class ChatMessageIn(BaseModel):
    content: str


class ChatProfileOut(BaseModel):
    id: str
    full_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    is_online: Optional[bool] = None
    last_seen: Optional[datetime] = None


class ChatOut(BaseModel):
    id: str
    participant_1: str
    participant_2: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    participant_1_profile: Optional[ChatProfileOut] = None
    participant_2_profile: Optional[ChatProfileOut] = None

    model_config = {"from_attributes": True}


class ChatMessageOut(BaseModel):
    id: str
    chat_id: str
    sender_id: str
    content: Optional[str] = None
    type: Optional[str] = "text"
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    is_read: Optional[bool] = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
