"""Chat / Messaging service — handles groups, messages, direct chats, and translation."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from app.application.ports import (
    ChatGroupRepository,
    GroupParticipantRepository,
    ChatMessageRepository,
    DirectChatRepository,
    UserChatSettingsRepository,
    TranslationClient,
)
from app.domain.entities import (
    ChatGroup,
    GroupParticipant,
    ChatMessage,
    DirectChat,
    UserChatSettings,
    User,
    GroupType,
    MessageType,
)


class ChatService:
    def __init__(
        self,
        groups: ChatGroupRepository,
        participants: GroupParticipantRepository,
        messages: ChatMessageRepository,
        direct_chats: DirectChatRepository,
        settings_repo: UserChatSettingsRepository,
        translator: TranslationClient,
    ) -> None:
        self._groups = groups
        self._participants = participants
        self._messages = messages
        self._direct_chats = direct_chats
        self._settings = settings_repo
        self._translator = translator

    # ---- Groups -----------------------------------------------------------------

    def create_group(
        self,
        *,
        name: str,
        group_type: GroupType,
        created_by: str,
        description: str = "",
        placement_id: Optional[str] = None,
        org_id: Optional[str] = None,
        member_ids: Optional[list[str]] = None,
    ) -> ChatGroup:
        group_id = f"grp_{uuid4().hex[:12]}"
        now = datetime.utcnow().isoformat()
        
        group = ChatGroup(
            id=group_id,
            name=name,
            type=group_type,
            description=description,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            is_active=True,
            placement_id=placement_id,
            org_id=org_id,
        )
        self._groups.add(group)
        
        # Add creator as owner
        owner = GroupParticipant(
            id=f"gp_{uuid4().hex[:10]}",
            group_id=group_id,
            user_id=created_by,
            role="owner",
            joined_at=now,
        )
        self._participants.add(owner)
        
        # Add other members
        if member_ids:
            for uid in member_ids:
                if uid != created_by:
                    member = GroupParticipant(
                        id=f"gp_{uuid4().hex[:10]}",
                        group_id=group_id,
                        user_id=uid,
                        role="member",
                        joined_at=now,
                    )
                    self._participants.add(member)
        
        return group

    def get_group(self, group_id: str) -> Optional[ChatGroup]:
        return self._groups.get(group_id)

    def list_user_groups(self, user_id: str) -> list[ChatGroup]:
        return self._groups.list_for_user(user_id)

    def list_groups_by_type(
        self, group_type: GroupType, org_id: Optional[str] = None
    ) -> list[ChatGroup]:
        return self._groups.list_by_type(group_type.value, org_id)

    def add_member(
        self, group_id: str, user_id: str, role: str = "member"
    ) -> GroupParticipant:
        now = datetime.utcnow().isoformat()
        participant = GroupParticipant(
            id=f"gp_{uuid4().hex[:10]}",
            group_id=group_id,
            user_id=user_id,
            role=role,
            joined_at=now,
        )
        return self._participants.add(participant)

    def remove_member(self, group_id: str, user_id: str) -> bool:
        return self._participants.remove(group_id, user_id)

    def get_participants(self, group_id: str) -> list[GroupParticipant]:
        return self._participants.list_for_group(group_id)

    def update_participant(
        self, group_id: str, user_id: str, **fields
    ) -> Optional[GroupParticipant]:
        return self._participants.update(group_id, user_id, **fields)

    # ---- Direct Chats -----------------------------------------------------------

    def get_or_create_direct_chat(
        self, user1_id: str, user2_id: str
    ) -> DirectChat:
        return self._direct_chats.get_or_create(user1_id, user2_id)

    def list_direct_chats(self, user_id: str) -> list[DirectChat]:
        return self._direct_chats.list_for_user(user_id)

    # ---- Messages ---------------------------------------------------------------

    def send_group_message(
        self,
        *,
        group_id: str,
        sender_id: str,
        content: str,
        msg_type: MessageType = MessageType.TEXT,
        file_name: Optional[str] = None,
        file_size: Optional[int] = None,
        mime_type: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        waveform_data: Optional[str] = None,
        reply_to_id: Optional[str] = None,
    ) -> ChatMessage:
        message_id = f"msg_{uuid4().hex[:12]}"
        now = datetime.utcnow().isoformat()
        
        # Get sender's preferred language for original_language
        settings = self._settings.get(sender_id)
        original_lang = settings.preferred_language if settings else "en"
        
        message = ChatMessage(
            id=message_id,
            group_id=group_id,
            sender_id=sender_id,
            type=msg_type,
            content=content,
            original_language=original_lang,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            duration_seconds=duration_seconds,
            waveform_data=waveform_data,
            created_at=now,
            reply_to_id=reply_to_id,
        )
        self._messages.add(message)
        
        # Update group's updated_at
        self._groups.update(group_id, updated_at=now)
        
        return message

    def send_direct_message(
        self,
        *,
        sender_id: str,
        recipient_id: str,
        content: str,
        msg_type: MessageType = MessageType.TEXT,
        file_name: Optional[str] = None,
        file_size: Optional[int] = None,
        mime_type: Optional[str] = None,
        duration_seconds: Optional[int] = None,
        waveform_data: Optional[str] = None,
        reply_to_id: Optional[str] = None,
    ) -> ChatMessage:
        direct = self._direct_chats.get_or_create(sender_id, recipient_id)
        message_id = f"msg_{uuid4().hex[:12]}"
        now = datetime.utcnow().isoformat()
        
        settings = self._settings.get(sender_id)
        original_lang = settings.preferred_language if settings else "en"
        
        message = ChatMessage(
            id=message_id,
            group_id=None,
            sender_id=sender_id,
            recipient_id=recipient_id,
            type=msg_type,
            content=content,
            original_language=original_lang,
            file_name=file_name,
            file_size=file_size,
            mime_type=mime_type,
            duration_seconds=duration_seconds,
            waveform_data=waveform_data,
            created_at=now,
            reply_to_id=reply_to_id,
        )
        self._messages.add(message)
        
        # Update direct chat's last_message_at
        self._direct_chats.update_last_message(sender_id, recipient_id, message_id)
        
        return message

    def get_group_messages(
        self,
        group_id: str,
        *,
        limit: int = 50,
        before: Optional[str] = None,
        after: Optional[str] = None,
    ) -> list[ChatMessage]:
        return self._messages.list_for_group(group_id, limit=limit, before=before, after=after)

    def get_direct_messages(
        self,
        user1_id: str,
        user2_id: str,
        *,
        limit: int = 50,
        before: Optional[str] = None,
    ) -> list[ChatMessage]:
        return self._messages.list_direct(user1_id, user2_id, limit=limit, before=before)

    def edit_message(self, message_id: str, new_content: str) -> Optional[ChatMessage]:
        return self._messages.update(message_id, content=new_content, is_edited=True)

    def delete_message(self, message_id: str) -> bool:
        return self._messages.soft_delete(message_id)

    def mark_read(self, group_id: str, user_id: str, message_id: str) -> None:
        self._messages.mark_read(group_id, user_id, message_id)

    # ---- Translation ------------------------------------------------------------

    async def translate_message(
        self, message: ChatMessage, target_lang: str
    ) -> str:
        # Check cache first
        if target_lang in message.translations:
            return message.translations[target_lang]
        
        translated = await self._translator.translate(
            message.content, target_lang, message.original_language
        )
        
        # Cache translation
        updated = {**message.translations, target_lang: translated}
        self._messages.update(message_id=message.id, translations=updated)
        
        return translated

    async def translate_to_user_language(
        self, message: ChatMessage, user_id: str
    ) -> str:
        settings = self._settings.get(user_id)
        if not settings or not settings.auto_translate:
            return message.content
        
        target_lang = settings.preferred_language
        if target_lang == message.original_language:
            return message.content
        
        return await self.translate_message(message, target_lang)

    # ---- User Settings ----------------------------------------------------------

    def get_settings(self, user_id: str) -> UserChatSettings:
        settings = self._settings.get(user_id)
        if not settings:
            # Create default settings
            settings = UserChatSettings(
                user_id=user_id,
                preferred_language="en",
                auto_translate=True,
                show_original=True,
                notification_sound=True,
                desktop_notifications=True,
                theme="light",
                font_size=14,
                created_at=datetime.utcnow().isoformat(),
                updated_at=datetime.utcnow().isoformat(),
            )
            self._settings.upsert(settings)
        return settings

    def update_settings(
        self, user_id: str, **fields
    ) -> UserChatSettings:
        settings = self.get_settings(user_id)
        for k, v in fields.items():
            if hasattr(settings, k):
                setattr(settings, k, v)
        settings.updated_at = datetime.utcnow().isoformat()
        self._settings.upsert(settings)
        return settings


# ---- Auto-group creation helpers -----------------------------------------------

def create_placement_group(
    service: ChatService,
    placement_id: str,
    placement_title: str,
    creator_id: str,
    member_ids: list[str],
) -> ChatGroup:
    """Create a group for a placement with all applicants."""
    return service.create_group(
        name=f"💼 {placement_title}",
        group_type=GroupType.PLACEMENT,
        created_by=creator_id,
        description=f"Discussion for {placement_title} placement",
        placement_id=placement_id,
        member_ids=member_ids,
    )


def create_organization_group(
    service: ChatService,
    org_id: str,
    org_name: str,
    creator_id: str,
    member_ids: list[str],
) -> ChatGroup:
    """Create a group for an employer organization."""
    return service.create_group(
        name=f"🏢 {org_name} Team",
        group_type=GroupType.ORGANIZATION,
        created_by=creator_id,
        description=f"Internal chat for {org_name} team",
        org_id=org_id,
        member_ids=member_ids,
    )


def create_role_based_group(
    service: ChatService,
    group_type: GroupType,
    creator_id: str,
    name: str,
    member_ids: list[str],
) -> ChatGroup:
    """Create a role-based group (student, employer, admin)."""
    icons = {
        GroupType.STUDENT: "🎓",
        GroupType.EMPLOYER: "💼",
        GroupType.ADMIN: "🛡️",
        GroupType.MIXED: "💬",
    }
    return service.create_group(
        name=f"{icons.get(group_type, '💬')} {name}",
        group_type=group_type,
        created_by=creator_id,
        description=f"Community for {name}",
        member_ids=member_ids,
    )