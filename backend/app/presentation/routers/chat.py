"""Chat / Messaging API endpoints."""

from typing import Optional, Dict, Set
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.application.chat import ChatService
from app.application.ports import (
    ChatGroupRepository,
    GroupParticipantRepository,
    ChatMessageRepository,
    DirectChatRepository,
    UserChatSettingsRepository,
    TranslationClient,
)
from app.core.security import decode_access_token
from app.domain.entities import User, GroupType, MessageType
from app.infrastructure.db import get_session
from app.infrastructure.repositories import (
    SqlAlchemyChatGroupRepository,
    SqlAlchemyGroupParticipantRepository,
    SqlAlchemyChatMessageRepository,
    SqlAlchemyDirectChatRepository,
    SqlAlchemyUserChatSettingsRepository,
)
from app.presentation.deps import get_current_user, get_translation_client

router = APIRouter(prefix="/chat", tags=["chat"])

# ---- WebSocket Connection Manager ---------------------------------------------

class ConnectionManager:
    def __init__(self):
        # user_id -> set of websockets
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        # group_id -> set of websockets
        self.group_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, group_id: Optional[str] = None):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)
        
        if group_id:
            if group_id not in self.group_connections:
                self.group_connections[group_id] = set()
            self.group_connections[group_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str, group_id: Optional[str] = None):
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        if group_id and group_id in self.group_connections:
            self.group_connections[group_id].discard(websocket)
            if not self.group_connections[group_id]:
                del self.group_connections[group_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.user_connections:
            for ws in self.user_connections[user_id].copy():
                try:
                    await ws.send_json(message)
                except Exception:
                    self.user_connections[user_id].discard(ws)

    async def broadcast_to_group(self, message: dict, group_id: str, exclude_user: Optional[str] = None):
        if group_id in self.group_connections:
            for ws in self.group_connections[group_id].copy():
                try:
                    await ws.send_json(message)
                except Exception:
                    self.group_connections[group_id].discard(ws)

    async def broadcast_to_all(self, message: dict, exclude_user: Optional[str] = None):
        for user_id, connections in self.user_connections.items():
            if user_id != exclude_user:
                for ws in connections.copy():
                    try:
                        await ws.send_json(message)
                    except Exception:
                        connections.discard(ws)


manager = ConnectionManager()


# ---- Dependencies -------------------------------------------------------------

def get_chat_service(
    session: Session = Depends(get_session),
    translator: TranslationClient = Depends(get_translation_client),
) -> ChatService:
    return ChatService(
        groups=SqlAlchemyChatGroupRepository(session),
        participants=SqlAlchemyGroupParticipantRepository(session),
        messages=SqlAlchemyChatMessageRepository(session),
        direct_chats=SqlAlchemyDirectChatRepository(session),
        settings_repo=SqlAlchemyUserChatSettingsRepository(session),
        translator=translator,
    )


# ---- WebSocket Endpoint -------------------------------------------------------

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    group_id: Optional[str] = Query(None),
):
    """WebSocket for real-time chat.
    
    Connect with: ws://host/api/chat/ws?token=JWT_TOKEN&group_id=GROUP_ID
    """
    # Verify token
    try:
        payload = decode_access_token(token)
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    # Verify group membership if group_id provided
    if group_id:
        from app.infrastructure.db import SessionLocal
        from app.infrastructure.repositories import SqlAlchemyGroupParticipantRepository
        session = SessionLocal()
        try:
            participant_repo = SqlAlchemyGroupParticipantRepository(session)
            participant = participant_repo.get(group_id, user_id)
            if not participant:
                await websocket.close(code=4003, reason="Not a member of this group")
                return
        finally:
            session.close()
    
    await manager.connect(websocket, user_id, group_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            
            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif event_type == "typing":
                # Broadcast typing indicator to group
                if group_id:
                    await manager.broadcast_to_group(
                        {"type": "typing", "user_id": user_id, "group_id": group_id},
                        group_id,
                        exclude_user=user_id
                    )
            
            elif event_type == "read":
                # Mark messages as read
                message_ids = data.get("message_ids", [])
                # TODO: Implement read receipts
                pass
            
            elif event_type == "message":
                # New message sent via WebSocket
                # This is an alternative to REST API
                pass
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id, group_id)
    except Exception as e:
        manager.disconnect(websocket, user_id, group_id)


# ---- Schemas ------------------------------------------------------------------

class GroupCreate(BaseModel):
    name: str
    type: str  # student, employer, admin, mixed, placement, organization
    description: str = ""
    placement_id: Optional[str] = None
    org_id: Optional[str] = None
    member_ids: list[str] = []


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class MemberAdd(BaseModel):
    user_id: str
    role: str = "member"


class MemberUpdate(BaseModel):
    role: Optional[str] = None
    is_muted: Optional[bool] = None
    notifications_enabled: Optional[bool] = None


class MessageCreate(BaseModel):
    content: str
    type: str = "text"  # text, voice, image, file
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    duration_seconds: Optional[int] = None
    waveform_data: Optional[str] = None
    reply_to_id: Optional[str] = None


class MessageUpdate(BaseModel):
    content: str


class DirectMessageCreate(BaseModel):
    recipient_id: str
    content: str
    type: str = "text"
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    duration_seconds: Optional[int] = None
    waveform_data: Optional[str] = None
    reply_to_id: Optional[str] = None


class SettingsUpdate(BaseModel):
    preferred_language: Optional[str] = None
    auto_translate: Optional[bool] = None
    show_original: Optional[bool] = None
    notification_sound: Optional[bool] = None
    desktop_notifications: Optional[bool] = None
    theme: Optional[str] = None
    font_size: Optional[int] = None


# ---- Groups -------------------------------------------------------------------

@router.post("/groups", response_model=dict)
def create_group(
    payload: GroupCreate,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    try:
        group_type = GroupType(payload.type)
    except ValueError:
        raise HTTPException(400, "Invalid group type")
    
    group = service.create_group(
        name=payload.name,
        group_type=group_type,
        created_by=current_user.id,
        description=payload.description,
        placement_id=payload.placement_id,
        org_id=payload.org_id,
        member_ids=payload.member_ids,
    )
    return {"group": group}


@router.get("/groups", response_model=dict)
def list_my_groups(
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    groups = service.list_user_groups(current_user.id)
    return {"groups": groups}


@router.get("/groups/type/{group_type}", response_model=dict)
def list_groups_by_type(
    group_type: str,
    org_id: Optional[str] = None,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    try:
        gtype = GroupType(group_type)
    except ValueError:
        raise HTTPException(400, "Invalid group type")
    
    # Admin can see all groups of a type
    if current_user.role == "admin":
        groups = service.list_groups_by_type(gtype, org_id)
    else:
        # Non-admins only see groups they're members of
        groups = [g for g in service.list_user_groups(current_user.id) if g.type == gtype]
    
    return {"groups": groups}


@router.get("/groups/{group_id}", response_model=dict)
def get_group(
    group_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    # Check if user is member or admin
    participants = service.get_participants(group_id)
    is_member = any(p.user_id == current_user.id for p in participants)
    if not is_member and current_user.role != "admin":
        raise HTTPException(403, "Not a member of this group")
    
    return {"group": group, "participants": participants}


@router.patch("/groups/{group_id}", response_model=dict)
def update_group(
    group_id: str,
    payload: GroupUpdate,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    # Only owner/admin can update
    participants = service.get_participants(group_id)
    me = next((p for p in participants if p.user_id == current_user.id), None)
    if not me or me.role not in ("owner", "admin") and current_user.role != "admin":
        raise HTTPException(403, "Not authorized")
    
    update_data = payload.model_dump(exclude_unset=True)
    updated = service._groups.update(group_id, **update_data)
    return {"group": updated}


@router.delete("/groups/{group_id}", response_model=dict)
def delete_group(
    group_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    # Only owner can delete
    participants = service.get_participants(group_id)
    me = next((p for p in participants if p.user_id == current_user.id), None)
    if not me or me.role != "owner":
        raise HTTPException(403, "Only owner can delete group")
    
    service._groups.delete(group_id)
    return {"deleted": True}


# ---- Group Members ------------------------------------------------------------

@router.get("/groups/{group_id}/members", response_model=dict)
def get_members(
    group_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    participants = service.get_participants(group_id)
    return {"participants": participants}


@router.post("/groups/{group_id}/members", response_model=dict)
def add_member(
    group_id: str,
    payload: MemberAdd,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    # Check if user can add members
    participants = service.get_participants(group_id)
    me = next((p for p in participants if p.user_id == current_user.id), None)
    if not me or me.role not in ("owner", "admin") and current_user.role != "admin":
        raise HTTPException(403, "Not authorized to add members")
    
    # Admin auto-added to all groups
    if current_user.role == "admin" and payload.user_id != current_user.id:
        service.add_member(group_id, current_user.id, "admin")
    
    participant = service.add_member(group_id, payload.user_id, payload.role)
    return {"participant": participant}


@router.patch("/groups/{group_id}/members/{user_id}", response_model=dict)
def update_member(
    group_id: str,
    user_id: str,
    payload: MemberUpdate,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    participants = service.get_participants(group_id)
    me = next((p for p in participants if p.user_id == current_user.id), None)
    if not me or me.role not in ("owner", "admin") and current_user.role != "admin":
        raise HTTPException(403, "Not authorized")
    
    updated = service.update_participant(group_id, user_id, **payload.model_dump(exclude_unset=True))
    return {"participant": updated}


@router.delete("/groups/{group_id}/members/{user_id}", response_model=dict)
def remove_member(
    group_id: str,
    user_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    participants = service.get_participants(group_id)
    me = next((p for p in participants if p.user_id == current_user.id), None)
    target = next((p for p in participants if p.user_id == user_id), None)
    
    if not me or (me.role not in ("owner", "admin") and current_user.role != "admin"):
        raise HTTPException(403, "Not authorized")
    
    if target and target.role == "owner" and me.role != "owner":
        raise HTTPException(403, "Cannot remove owner")
    
    service.remove_member(group_id, user_id)
    return {"removed": True}


# ---- Messages -----------------------------------------------------------------

@router.get("/groups/{group_id}/messages", response_model=dict)
def get_messages(
    group_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    after: Optional[str] = None,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    participants = service.get_participants(group_id)
    is_member = any(p.user_id == current_user.id for p in participants)
    if not is_member and current_user.role != "admin":
        raise HTTPException(403, "Not a member")
    
    messages = service.get_group_messages(group_id, limit=limit, before=before, after=after)
    
    # Auto-translate for current user
    import asyncio
    translated = []
    for msg in messages:
        t = asyncio.run(service.translate_to_user_language(msg, current_user.id))
        translated.append({**msg.__dict__, "translated_content": t})
    
    return {"messages": translated}


@router.post("/groups/{group_id}/messages", response_model=dict)
def send_message(
    group_id: str,
    payload: MessageCreate,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    group = service.get_group(group_id)
    if not group:
        raise HTTPException(404, "Group not found")
    
    participants = service.get_participants(group_id)
    is_member = any(p.user_id == current_user.id for p in participants)
    if not is_member and current_user.role != "admin":
        raise HTTPException(403, "Not a member")
    
    try:
        msg_type = MessageType(payload.type)
    except ValueError:
        raise HTTPException(400, "Invalid message type")
    
    message = service.send_group_message(
        group_id=group_id,
        sender_id=current_user.id,
        content=payload.content,
        msg_type=msg_type,
        file_name=payload.file_name,
        file_size=payload.file_size,
        mime_type=payload.mime_type,
        duration_seconds=payload.duration_seconds,
        waveform_data=payload.waveform_data,
        reply_to_id=payload.reply_to_id,
    )
    
    # Broadcast to WebSocket connections
    import asyncio
    asyncio.run(manager.broadcast_to_group(
        {
            "type": "message",
            "message": {
                "id": message.id,
                "group_id": message.group_id,
                "sender_id": message.sender_id,
                "recipient_id": message.recipient_id,
                "type": message.type,
                "content": message.content,
                "original_language": message.original_language,
                "duration_seconds": message.duration_seconds,
                "waveform_data": message.waveform_data,
                "file_name": message.file_name,
                "file_size": message.file_size,
                "mime_type": message.mime_type,
                "created_at": message.created_at,
                "updated_at": message.updated_at,
                "deleted_at": message.deleted_at,
                "is_edited": message.is_edited,
                "reply_to_id": message.reply_to_id,
                "translations": message.translations,
            }
        },
        group_id,
    ))
    
    return {"message": message}


@router.patch("/messages/{message_id}", response_model=dict)
def edit_message(
    message_id: str,
    payload: MessageUpdate,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    message = service._messages.get(message_id)
    if not message:
        raise HTTPException(404, "Message not found")
    
    if message.sender_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Not authorized")
    
    updated = service.edit_message(message_id, payload.content)
    return {"message": updated}


@router.delete("/messages/{message_id}", response_model=dict)
def delete_message(
    message_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    message = service._messages.get(message_id)
    if not message:
        raise HTTPException(404, "Message not found")
    
    if message.sender_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Not authorized")
    
    service.delete_message(message_id)
    return {"deleted": True}


@router.post("/messages/{message_id}/read", response_model=dict)
def mark_read(
    message_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    message = service._messages.get(message_id)
    if not message or not message.group_id:
        raise HTTPException(404, "Message not found")
    
    service.mark_read(message.group_id, current_user.id, message_id)
    return {"marked_read": True}


# ---- Direct Messages ----------------------------------------------------------

@router.post("/direct", response_model=dict)
def send_direct_message(
    payload: DirectMessageCreate,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    try:
        msg_type = MessageType(payload.type)
    except ValueError:
        raise HTTPException(400, "Invalid message type")
    
    message = service.send_direct_message(
        sender_id=current_user.id,
        recipient_id=payload.recipient_id,
        content=payload.content,
        msg_type=msg_type,
        file_name=payload.file_name,
        file_size=payload.file_size,
        mime_type=payload.mime_type,
        duration_seconds=payload.duration_seconds,
        waveform_data=payload.waveform_data,
        reply_to_id=payload.reply_to_id,
    )
    return {"message": message}


@router.get("/direct/{other_user_id}", response_model=dict)
def get_direct_messages(
    other_user_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    messages = service.get_direct_messages(current_user.id, other_user_id, limit=limit, before=before)
    
    # Auto-translate
    import asyncio
    translated = []
    for msg in messages:
        t = asyncio.run(service.translate_to_user_language(msg, current_user.id))
        translated.append({**msg.__dict__, "translated_content": t})
    
    return {"messages": translated}


@router.get("/direct", response_model=dict)
def list_direct_chats(
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    chats = service.list_direct_chats(current_user.id)
    return {"chats": chats}


# ---- Translation --------------------------------------------------------------

@router.post("/translate", response_model=dict)
async def translate_text(
    text: str = Form(...),
    target_lang: str = Form(...),
    source_lang: str = Form("auto"),
    translator: TranslationClient = Depends(get_translation_client),
    current_user: User = Depends(get_current_user),
):
    translated = await translator.translate(text, target_lang, source_lang)
    return {"translated": translated, "target_lang": target_lang}


@router.post("/detect-language", response_model=dict)
async def detect_language(
    text: str = Form(...),
    translator: TranslationClient = Depends(get_translation_client),
    current_user: User = Depends(get_current_user),
):
    lang = await translator.detect_language(text)
    return {"language": lang}


# ---- User Settings ------------------------------------------------------------

@router.get("/settings", response_model=dict)
def get_settings(
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    settings = service.get_settings(current_user.id)
    return {"settings": settings}


@router.patch("/settings", response_model=dict)
def update_settings(
    payload: SettingsUpdate,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user),
):
    updated = service.update_settings(current_user.id, **payload.model_dump(exclude_unset=True))
    return {"settings": updated}