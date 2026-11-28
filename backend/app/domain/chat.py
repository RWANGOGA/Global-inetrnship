"""Chat / messaging bounded context."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ChatType(Enum):
    DIRECT = "direct"
    GROUP = "group"
    CHANNEL = "channel"  # Admin broadcast


class MessageType(Enum):
    TEXT = "text"
    VOICE = "voice"
    IMAGE = "image"
    FILE = "file"
    SYSTEM = "system"


class GroupType(Enum):
    STUDENT = "student"
    EMPLOYER = "employer"
    ADMIN = "admin"
    MIXED = "mixed"
    PLACEMENT = "placement"  # Auto-created for each placement
    ORGANIZATION = "organization"  # Per employer org


@dataclass(frozen=True)
class ChatGroup:
    """A chat group (like WhatsApp group)."""

    id: str
    name: str
    type: GroupType
    description: str = ""
    avatar_url: Optional[str] = None
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""
    is_active: bool = True
    placement_id: Optional[str] = None
    org_id: Optional[str] = None


@dataclass(frozen=True)
class GroupParticipant:
    """A participant in a chat group."""

    id: str
    group_id: str
    user_id: str
    role: str = "member"  # member, admin, owner
    joined_at: str = ""
    last_read_at: Optional[str] = None
    is_muted: bool = False
    notifications_enabled: bool = True


@dataclass(frozen=True)
class ChatMessage:
    """A message in a chat (direct or group)."""

    id: str
    group_id: Optional[str] = None  # None for direct messages
    sender_id: str = ""
    recipient_id: Optional[str] = None  # For direct messages
    type: MessageType = MessageType.TEXT
    content: str = ""  # Text content or file path
    original_language: str = "en"
    duration_seconds: Optional[int] = None
    waveform_data: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: str = ""
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None
    is_edited: bool = False
    reply_to_id: Optional[str] = None
    translations: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class DirectChat:
    """A direct (1-on-1) chat between two users."""

    id: str
    user1_id: str
    user2_id: str
    created_at: str = ""
    last_message_at: Optional[str] = None


@dataclass(frozen=True)
class UserChatSettings:
    """User's chat preferences."""

    user_id: str
    preferred_language: str = "en"  # ISO 639-1 code
    auto_translate: bool = True
    show_original: bool = True
    notification_sound: bool = True
    desktop_notifications: bool = True
    theme: str = "light"  # light, dark, system
    font_size: int = 14
    created_at: str = ""
    updated_at: str = ""
