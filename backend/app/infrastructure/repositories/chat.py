"""Chat bounded context: groups, participants, messages, direct chats, settings."""
from app.infrastructure.repositories._base import AutocommitMixin
from datetime import datetime
from typing import Optional
from uuid import uuid4
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.domain.commands import ChatGroupUpdate, ChatMessageUpdate, GroupParticipantUpdate
from app.application.ports import (
    ChatGroupRepository,
    GroupParticipantRepository,
    ChatMessageRepository,
    DirectChatRepository,
    UserChatSettingsRepository,
)
from app.domain.entities import (
    ChatGroup,
    GroupParticipant,
    ChatMessage,
    DirectChat,
    UserChatSettings,
    GroupType,
    MessageType,
)
from app.infrastructure.orm import (
    ChatGroupORM,
    GroupParticipantORM,
    ChatMessageORM,
    DirectChatORM,
    UserChatSettingsORM,
)

class SqlAlchemyChatGroupRepository(AutocommitMixin, ChatGroupRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    def add(self, group: ChatGroup) -> ChatGroup:
        row = ChatGroupORM(
            id=group.id,
            name=group.name,
            type=group.type.value if isinstance(group.type, GroupType) else group.type,
            description=group.description,
            avatar_url=group.avatar_url,
            created_by=group.created_by,
            created_at=group.created_at,
            updated_at=group.updated_at,
            is_active=group.is_active,
            placement_id=group.placement_id,
            org_id=group.org_id,
        )
        self._session.add(row)
        self._persist()
        return group

    def get(self, group_id: str) -> Optional[ChatGroup]:
        row = self._session.query(ChatGroupORM).filter_by(id=group_id).first()
        if not row:
            return None
        return ChatGroup(
            id=row.id,
            name=row.name,
            type=GroupType(row.type),
            description=row.description,
            avatar_url=row.avatar_url,
            created_by=row.created_by,
            created_at=row.created_at,
            updated_at=row.updated_at,
            is_active=row.is_active,
            placement_id=row.placement_id,
            org_id=row.org_id,
        )

    def list_for_user(self, user_id: str) -> list[ChatGroup]:
        rows = (
            self._session.query(ChatGroupORM)
            .join(GroupParticipantORM, ChatGroupORM.id == GroupParticipantORM.group_id)
            .filter(GroupParticipantORM.user_id == user_id)
            .filter(ChatGroupORM.is_active == True)
            .order_by(ChatGroupORM.updated_at.desc())
            .all()
        )
        return [
            ChatGroup(
                id=r.id,
                name=r.name,
                type=GroupType(r.type),
                description=r.description,
                avatar_url=r.avatar_url,
                created_by=r.created_by,
                created_at=r.created_at,
                updated_at=r.updated_at,
                is_active=r.is_active,
                placement_id=r.placement_id,
                org_id=r.org_id,
            )
            for r in rows
        ]

    def list_all(self) -> list[ChatGroup]:
        rows = (
            self._session.query(ChatGroupORM)
            .filter(ChatGroupORM.is_active == True)
            .order_by(ChatGroupORM.name)
            .all()
        )
        return [
            ChatGroup(
                id=row.id,
                name=row.name,
                type=GroupType(row.type),
                description=row.description,
                avatar_url=row.avatar_url,
                created_by=row.created_by,
                created_at=row.created_at,
                updated_at=row.updated_at,
                is_active=row.is_active,
                placement_id=row.placement_id,
                org_id=row.org_id,
            )
            for row in rows
        ]

    def list_by_type(self, group_type: str, org_id: Optional[str] = None) -> list[ChatGroup]:
        query = self._session.query(ChatGroupORM).filter(
            ChatGroupORM.type == group_type,
            ChatGroupORM.is_active == True
        )
        if org_id:
            query = query.filter(ChatGroupORM.org_id == org_id)
        rows = query.order_by(ChatGroupORM.name).all()
        return [
            ChatGroup(
                id=r.id,
                name=r.name,
                type=GroupType(r.type),
                description=r.description,
                avatar_url=r.avatar_url,
                created_by=r.created_by,
                created_at=r.created_at,
                updated_at=r.updated_at,
                is_active=r.is_active,
                placement_id=r.placement_id,
                org_id=r.org_id,
            )
            for r in rows
        ]

    def update(self, group_id: str, changes: ChatGroupUpdate) -> Optional[ChatGroup]:
        row = self._session.query(ChatGroupORM).filter_by(id=group_id).first()
        if not row:
            return None
        for k, v in changes.changed_fields().items():
            if hasattr(row, k):
                setattr(row, k, v)
        row.updated_at = datetime.utcnow().isoformat()
        self._persist()
        return self.get(group_id)

    def delete(self, group_id: str) -> bool:
        row = self._session.query(ChatGroupORM).filter_by(id=group_id).first()
        if not row:
            return False
        row.is_active = False
        self._persist()
        return True

class SqlAlchemyGroupParticipantRepository(AutocommitMixin, GroupParticipantRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    def add(self, participant: GroupParticipant) -> GroupParticipant:
        row = GroupParticipantORM(
            id=participant.id,
            group_id=participant.group_id,
            user_id=participant.user_id,
            role=participant.role,
            joined_at=participant.joined_at,
            last_read_at=participant.last_read_at,
            is_muted=participant.is_muted,
            notifications_enabled=participant.notifications_enabled,
        )
        self._session.add(row)
        self._persist()
        return participant

    def get(self, group_id: str, user_id: str) -> Optional[GroupParticipant]:
        row = self._session.query(GroupParticipantORM).filter_by(
            group_id=group_id, user_id=user_id
        ).first()
        if not row:
            return None
        return GroupParticipant(
            id=row.id,
            group_id=row.group_id,
            user_id=row.user_id,
            role=row.role,
            joined_at=row.joined_at,
            last_read_at=row.last_read_at,
            is_muted=row.is_muted,
            notifications_enabled=row.notifications_enabled,
        )

    def list_for_group(self, group_id: str) -> list[GroupParticipant]:
        rows = self._session.query(GroupParticipantORM).filter_by(group_id=group_id).all()
        return [
            GroupParticipant(
                id=r.id,
                group_id=r.group_id,
                user_id=r.user_id,
                role=r.role,
                joined_at=r.joined_at,
                last_read_at=r.last_read_at,
                is_muted=r.is_muted,
                notifications_enabled=r.notifications_enabled,
            )
            for r in rows
        ]

    def list_for_user(self, user_id: str) -> list[GroupParticipant]:
        rows = self._session.query(GroupParticipantORM).filter_by(user_id=user_id).all()
        return [
            GroupParticipant(
                id=r.id,
                group_id=r.group_id,
                user_id=r.user_id,
                role=r.role,
                joined_at=r.joined_at,
                last_read_at=r.last_read_at,
                is_muted=r.is_muted,
                notifications_enabled=r.notifications_enabled,
            )
            for r in rows
        ]

    def update(self, group_id: str, user_id: str, changes: GroupParticipantUpdate) -> Optional[GroupParticipant]:
        row = self._session.query(GroupParticipantORM).filter_by(
            group_id=group_id, user_id=user_id
        ).first()
        if not row:
            return None
        for k, v in changes.changed_fields().items():
            if hasattr(row, k):
                setattr(row, k, v)
        self._persist()
        return self.get(group_id, user_id)

    def remove(self, group_id: str, user_id: str) -> bool:
        row = self._session.query(GroupParticipantORM).filter_by(
            group_id=group_id, user_id=user_id
        ).first()
        if not row:
            return False
        self._session.delete(row)
        self._persist()
        return True

class SqlAlchemyChatMessageRepository(AutocommitMixin, ChatMessageRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    def _to_entity(self, row: "ChatMessageORM") -> ChatMessage:
        return ChatMessage(
            id=row.id,
            group_id=row.group_id,
            sender_id=row.sender_id,
            recipient_id=row.recipient_id,
            type=MessageType(row.type),
            content=row.content,
            original_language=row.original_language,
            duration_seconds=row.duration_seconds,
            waveform_data=row.waveform_data,
            file_name=row.file_name,
            file_size=row.file_size,
            mime_type=row.mime_type,
            created_at=row.created_at,
            updated_at=row.updated_at,
            deleted_at=row.deleted_at,
            is_edited=row.is_edited,
            reply_to_id=row.reply_to_id,
            translations=row.translations or {},
        )

    def add(self, message: ChatMessage) -> ChatMessage:
        row = ChatMessageORM(
            id=message.id,
            group_id=message.group_id,
            sender_id=message.sender_id,
            recipient_id=message.recipient_id,
            type=message.type.value if isinstance(message.type, MessageType) else message.type,
            content=message.content,
            original_language=message.original_language,
            duration_seconds=message.duration_seconds,
            waveform_data=message.waveform_data,
            file_name=message.file_name,
            file_size=message.file_size,
            mime_type=message.mime_type,
            created_at=message.created_at,
            updated_at=message.updated_at,
            deleted_at=message.deleted_at,
            is_edited=message.is_edited,
            reply_to_id=message.reply_to_id,
            translations=message.translations,
        )
        self._session.add(row)
        self._persist()
        return message

    def get(self, message_id: str) -> Optional[ChatMessage]:
        row = self._session.query(ChatMessageORM).filter_by(id=message_id).first()
        if not row:
            return None
        return self._to_entity(row)

    def list_for_group(
        self,
        group_id: str,
        *,
        limit: int = 50,
        before: Optional[str] = None,
        after: Optional[str] = None,
    ) -> list[ChatMessage]:
        query = (
            self._session.query(ChatMessageORM)
            .filter_by(group_id=group_id, deleted_at=None)
            .order_by(ChatMessageORM.created_at.desc())
        )
        if before:
            query = query.filter(ChatMessageORM.created_at < before)
        if after:
            query = query.filter(ChatMessageORM.created_at > after)
        rows = query.limit(limit).all()
        return [self._to_entity(r) for r in reversed(rows)]

    def list_direct(
        self,
        user1_id: str,
        user2_id: str,
        *,
        limit: int = 50,
        before: Optional[str] = None,
    ) -> list[ChatMessage]:
        query = (
            self._session.query(ChatMessageORM)
            .filter(
                ChatMessageORM.group_id.is_(None),
                ChatMessageORM.deleted_at.is_(None),
                or_(
                    (ChatMessageORM.sender_id == user1_id) & (ChatMessageORM.recipient_id == user2_id),
                    (ChatMessageORM.sender_id == user2_id) & (ChatMessageORM.recipient_id == user1_id),
                )
            )
            .order_by(ChatMessageORM.created_at.desc())
        )
        if before:
            query = query.filter(ChatMessageORM.created_at < before)
        rows = query.limit(limit).all()
        return [self._to_entity(r) for r in reversed(rows)]

    def update(self, message_id: str, changes: ChatMessageUpdate) -> Optional[ChatMessage]:
        row = self._session.query(ChatMessageORM).filter_by(id=message_id).first()
        if not row:
            return None
        for k, v in changes.changed_fields().items():
            if hasattr(row, k):
                setattr(row, k, v)
        row.updated_at = datetime.utcnow().isoformat()
        self._persist()
        return self.get(message_id)

    def soft_delete(self, message_id: str) -> bool:
        row = self._session.query(ChatMessageORM).filter_by(id=message_id).first()
        if not row:
            return False
        row.deleted_at = datetime.utcnow().isoformat()
        self._persist()
        return True

    def mark_read(self, group_id: str, user_id: str, message_id: str) -> None:
        participant = (
            self._session.query(GroupParticipantORM)
            .filter_by(group_id=group_id, user_id=user_id)
            .first()
        )
        if participant:
            participant.last_read_at = datetime.utcnow().isoformat()
            self._persist()

class SqlAlchemyDirectChatRepository(AutocommitMixin, DirectChatRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    def get_or_create(self, user1_id: str, user2_id: str) -> DirectChat:
        # Ensure consistent ordering
        if user1_id > user2_id:
            user1_id, user2_id = user2_id, user1_id
        
        row = (
            self._session.query(DirectChatORM)
            .filter_by(user1_id=user1_id, user2_id=user2_id)
            .first()
        )
        if row:
            return DirectChat(
                id=row.id,
                user1_id=row.user1_id,
                user2_id=row.user2_id,
                created_at=row.created_at,
                last_message_at=row.last_message_at,
            )
        
        import uuid
        chat_id = f"dc_{uuid.uuid4().hex[:12]}"
        row = DirectChatORM(
            id=chat_id,
            user1_id=user1_id,
            user2_id=user2_id,
            created_at=datetime.utcnow().isoformat(),
        )
        self._session.add(row)
        self._persist()
        return DirectChat(
            id=row.id,
            user1_id=row.user1_id,
            user2_id=row.user2_id,
            created_at=row.created_at,
            last_message_at=row.last_message_at,
        )

    def get(self, user1_id: str, user2_id: str) -> Optional[DirectChat]:
        if user1_id > user2_id:
            user1_id, user2_id = user2_id, user1_id
        row = (
            self._session.query(DirectChatORM)
            .filter_by(user1_id=user1_id, user2_id=user2_id)
            .first()
        )
        if not row:
            return None
        return DirectChat(
            id=row.id,
            user1_id=row.user1_id,
            user2_id=row.user2_id,
            created_at=row.created_at,
            last_message_at=row.last_message_at,
        )

    def list_for_user(self, user_id: str) -> list[DirectChat]:
        rows = (
            self._session.query(DirectChatORM)
            .filter(
                (DirectChatORM.user1_id == user_id) | (DirectChatORM.user2_id == user_id)
            )
            .order_by(DirectChatORM.last_message_at.desc().nullslast())
            .all()
        )
        return [
            DirectChat(
                id=r.id,
                user1_id=r.user1_id,
                user2_id=r.user2_id,
                created_at=r.created_at,
                last_message_at=r.last_message_at,
            )
            for r in rows
        ]

    def update_last_message(self, user1_id: str, user2_id: str, message_id: str) -> None:
        if user1_id > user2_id:
            user1_id, user2_id = user2_id, user1_id
        row = (
            self._session.query(DirectChatORM)
            .filter_by(user1_id=user1_id, user2_id=user2_id)
            .first()
        )
        if row:
            row.last_message_at = datetime.utcnow().isoformat()
            self._persist()

class SqlAlchemyUserChatSettingsRepository(AutocommitMixin, UserChatSettingsRepository):
    def __init__(self, session: Session, *, autocommit: bool = True) -> None:
        self._init_session(session, autocommit)

    def get(self, user_id: str) -> Optional[UserChatSettings]:
        row = self._session.query(UserChatSettingsORM).filter_by(user_id=user_id).first()
        if not row:
            return None
        return UserChatSettings(
            user_id=row.user_id,
            preferred_language=row.preferred_language,
            auto_translate=row.auto_translate,
            show_original=row.show_original,
            notification_sound=row.notification_sound,
            desktop_notifications=row.desktop_notifications,
            theme=row.theme,
            font_size=row.font_size,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    def upsert(self, settings: UserChatSettings) -> UserChatSettings:
        row = self._session.query(UserChatSettingsORM).filter_by(user_id=settings.user_id).first()
        if not row:
            row = UserChatSettingsORM(user_id=settings.user_id)
            self._session.add(row)
        
        row.preferred_language = settings.preferred_language
        row.auto_translate = settings.auto_translate
        row.show_original = settings.show_original
        row.notification_sound = settings.notification_sound
        row.desktop_notifications = settings.desktop_notifications
        row.theme = settings.theme
        row.font_size = settings.font_size
        row.updated_at = datetime.utcnow().isoformat()
        
        self._persist()
        return settings
