"""Ports (interfaces) the application layer depends on.

High-level use cases depend on these abstractions, never on concrete adapters.
Postgres/SQLite repositories and, later, the Groq client implement them — that
is what keeps the domain swappable and the tests offline (SOLID: DIP + ISP).
"""
from abc import ABC, abstractmethod
from typing import Optional
from dataclasses import dataclass

from app.domain.entities import (
    AdminActionLog, Application, Job, LearningResource, Placement, Resume,
    StudentDocument, StudentProfile, Subscription, User, Invoice, Transaction,
    StudentUsage, JobApplication,
    ChatGroup, GroupParticipant, ChatMessage, DirectChat, UserChatSettings,
    GroupType, MessageType
)


class PlacementRepository(ABC):
    """Read access to the placements catalogue."""

    @abstractmethod
    def list(
        self,
        *,
        q: Optional[str] = None,
        org_type: Optional[str] = None,
        location: Optional[str] = None,
        mode: Optional[str] = None,
    ) -> list[Placement]:
        """Return placements, optionally filtered by keyword / employer type /
        location / work mode."""

    @abstractmethod
    def get(self, placement_id: str) -> Optional[Placement]:
        """Return a single placement by id, or None."""

    @abstractmethod
    def update(self, placement_id: str, **fields) -> Optional[Placement]:
        """Update mutable fields on a placement and return the updated domain object."""


class JobRepository(ABC):
    @abstractmethod
    def list(
        self,
        *,
        q: Optional[str] = None,
        location: Optional[str] = None,
        mode: Optional[str] = None,
    ) -> list[Job]:
        """Return open jobs matching the requested filters."""

    @abstractmethod
    def get(self, job_id: str) -> Optional[Job]: ...


class LLMClient(ABC):
    """Port for the language model behind the career advisor.

    The advisor depends on this abstraction, so production can talk to Groq
    while tests inject a deterministic fake — no network, no API key, fully
    offline. (SOLID: DIP.)
    """

    @abstractmethod
    def complete(self, prompt: str) -> str:
        """Return the model's answer to a single prompt."""


class VoiceClient(ABC):
    """Port for the voice service (TTS/STT) behind the voice features.

    The voice features depend on this abstraction, so production can talk to DeepL
    while tests inject a deterministic fake — no network, no API key, fully
    offline. (SOLID: DIP.)
    """

    @abstractmethod
    async def text_to_speech(self, text: str, options: "VoiceOptions" = None) -> bytes:
        """Convert text to speech audio bytes."""

    @abstractmethod
    async def speech_to_text(self, audio_data: bytes, options: "VoiceOptions" = None) -> str:
        """Convert speech audio bytes to text."""

    @abstractmethod
    async def close(self) -> None:
        """Close any open connections."""


@dataclass
class VoiceOptions:
    lang: str = "EN-US"
    voice: str = "default"
    speed: float = 1.0


class SavedRepository(ABC):
    """A user's bookmarked placements."""

    @abstractmethod
    def list(self, user_id: str) -> list[str]:
        """Placement ids the user has saved (deterministic order)."""

    @abstractmethod
    def is_saved(self, user_id: str, placement_id: str) -> bool: ...

    @abstractmethod
    def toggle(self, user_id: str, placement_id: str) -> bool:
        """Add if absent, remove if present. Return the new saved state."""


class SavedJobsRepository(ABC):
    """A user's bookmarked jobs."""

    @abstractmethod
    def list(self, user_id: str) -> list[str]:
        """Job ids the user has saved (deterministic order)."""

    @abstractmethod
    def is_saved(self, user_id: str, job_id: str) -> bool: ...

    @abstractmethod
    def toggle(self, user_id: str, job_id: str) -> bool:
        """Add if absent, remove if present. Return the new saved state."""


class ApplicationRepository(ABC):
    """Submissions students make to placements."""

    @abstractmethod
    def add(self, application: Application) -> Application: ...

    @abstractmethod
    def find(self, user_id: str, placement_id: str) -> Optional[Application]: ...

    @abstractmethod
    def find_by_id(self, application_id: str) -> Optional[Application]: ...

    @abstractmethod
    def list_for_user(self, user_id: str) -> list[Application]: ...

    @abstractmethod
    def list_for_placement(self, placement_id: str) -> list[Application]: ...

    @abstractmethod
    def withdraw(self, user_id: str, application_id: str) -> Optional[Application]: ...


class JobApplicationRepository(ABC):
    """Submissions jobseekers make to job postings."""

    @abstractmethod
    def add(self, application: JobApplication) -> JobApplication: ...

    @abstractmethod
    def find(self, user_id: str, job_id: str) -> Optional[JobApplication]: ...

    @abstractmethod
    def find_by_id(self, application_id: str) -> Optional[JobApplication]: ...

    @abstractmethod
    def list_for_user(self, user_id: str) -> list[JobApplication]: ...

    @abstractmethod
    def list_for_job(self, job_id: str) -> list[JobApplication]: ...

    @abstractmethod
    def update_status(self, application_id: str, status: str) -> Optional[JobApplication]: ...


class StudentProfileRepository(ABC):
    """Persisted academic profiles for student accounts."""

    @abstractmethod
    def get(self, user_id: str) -> StudentProfile: ...

    @abstractmethod
    def save(self, profile: StudentProfile) -> StudentProfile: ...


class ResumeRepository(ABC):
    @abstractmethod
    def get(self, user_id: str) -> Optional[Resume]: ...

    @abstractmethod
    def save(self, resume: Resume) -> Resume: ...


class LearningResourceRepository(ABC):
    """Admin-curated learning resources linked to skills and placements."""

    @abstractmethod
    def list(
        self,
        *,
        skill: Optional[str] = None,
        placement_id: Optional[str] = None,
    ) -> list[LearningResource]: ...

    @abstractmethod
    def get(self, resource_id: str) -> Optional[LearningResource]: ...

    @abstractmethod
    def add(self, resource: LearningResource) -> LearningResource: ...

    @abstractmethod
    def update(self, resource: LearningResource) -> LearningResource: ...

    @abstractmethod
    def delete(self, resource_id: str) -> bool: ...


class StudentDocumentRepository(ABC):
    @abstractmethod
    def list_for_user(self, user_id: str) -> list[StudentDocument]: ...

    @abstractmethod
    def get_by_id(self, document_id: str) -> Optional[StudentDocument]: ...

    @abstractmethod
    def list_all(self, status: Optional[str] = None) -> list[StudentDocument]: ...

    @abstractmethod
    def save(self, document: StudentDocument) -> StudentDocument: ...

    @abstractmethod
    def list_public_testimonials(self, limit: int = 10) -> list[StudentDocument]: ...


class SubscriptionRepository(ABC):
    """Host organisations' billing state."""

    @abstractmethod
    def get(self, org_id: str) -> Subscription:
        """Return the org's subscription, or a Free default if none exists."""

    @abstractmethod
    def save(self, subscription: Subscription) -> Subscription: ...


class InvoiceRepository(ABC):
    """Invoices for billing."""

    @abstractmethod
    def get(self, invoice_id: str) -> Optional[Invoice]: ...

    @abstractmethod
    def list_for_org(self, org_id: str, status: Optional[str] = None) -> list[Invoice]: ...

    @abstractmethod
    def find_by_gateway_id(self, gateway_id: str, gateway_invoice_id: str) -> Optional[Invoice]: ...

    @abstractmethod
    def find_by_number(self, invoice_number: str) -> Optional[Invoice]: ...

    @abstractmethod
    def list_outstanding(self) -> list[Invoice]:
        """All unpaid invoices past their due date (admin view)."""

    @abstractmethod
    def save(self, invoice: Invoice) -> Invoice: ...


class TransactionRepository(ABC):
    """Payment transactions (immutable ledger)."""

    @abstractmethod
    def get(self, transaction_id: str) -> Optional[Transaction]: ...

    @abstractmethod
    def list_for_org(self, org_id: str, status: Optional[str] = None) -> list[Transaction]: ...

    @abstractmethod
    def find_by_idempotency_key(self, key: str) -> Optional[Transaction]: ...

    @abstractmethod
    def find_by_invoice_and_type(self, invoice_id: str, type: str) -> Optional[Transaction]: ...

    @abstractmethod
    def save(self, transaction: Transaction) -> Transaction: ...


class StudentUsageRepository(ABC):
    """Student application usage tracking for billing."""

    @abstractmethod
    def get(self, user_id: str, month: str) -> Optional[StudentUsage]: ...

    @abstractmethod
    def get_or_create(self, user_id: str, month: str) -> StudentUsage: ...

    @abstractmethod
    def save(self, usage: StudentUsage) -> StudentUsage: ...


class PaymentGateway(ABC):
    """Abstract payment gateway - enables multiple providers with same interface."""

    @abstractmethod
    def create_customer(self, org_id: str, email: str, name: str, metadata: dict) -> "GatewayCustomer": ...

    @abstractmethod
    def get_or_create_customer(self, org_id: str) -> "GatewayCustomer": ...

    @abstractmethod
    def create_subscription(self, customer_id: str, price_id: str, trial_days: int = 0) -> "GatewaySubscription": ...

    @abstractmethod
    def cancel_subscription(self, subscription_id: str, at_period_end: bool = True) -> "GatewaySubscription": ...

    @abstractmethod
    def create_invoice(self, customer_id: str, line_items: list[dict], metadata: dict) -> "GatewayInvoice": ...

    @abstractmethod
    def finalize_invoice(self, invoice_id: str) -> "GatewayInvoice": ...

    @abstractmethod
    def pay_invoice(self, invoice_id: str, payment_method_id: str = None) -> "GatewayPayment": ...

    @abstractmethod
    def create_payment_method(self, customer_id: str, type: str, details: dict) -> "GatewayPaymentMethod": ...

    @abstractmethod
    def handle_webhook(self, payload: bytes, signature: str) -> "WebhookEvent": ...

    @abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool: ...

    @abstractmethod
    def get_supported_currencies(self) -> list[str]: ...

    @abstractmethod
    def calculate_fees(self, amount_cents: int, currency: str) -> "FeeBreakdown": ...


@dataclass
class GatewayCustomer:
    id: str
    email: str
    name: str
    metadata: dict


@dataclass
class GatewaySubscription:
    id: str
    customer_id: str
    status: str
    current_period_start: str
    current_period_end: str
    price_id: str


@dataclass
class GatewayInvoice:
    id: str
    customer_id: str
    amount_cents: int
    currency: str
    status: str
    line_items: list[dict]
    hosted_invoice_url: str | None = None


@dataclass
class GatewayPayment:
    id: str
    invoice_id: str
    amount_cents: int
    currency: str
    status: str
    raw_response: dict


@dataclass
class GatewayPaymentMethod:
    id: str
    customer_id: str
    type: str
    details: dict


@dataclass
class WebhookEvent:
    type: str
    data: dict
    raw_data: dict
    gateway: str


@dataclass
class FeeBreakdown:
    gateway_fee_cents: int
    platform_fee_cents: int
    net_amount_cents: int


class UserRepository(ABC):
    """Accounts for login and authorization."""

    @abstractmethod
    def add(self, user: User) -> User: ...

    @abstractmethod
    def get_by_email(self, email: str) -> Optional[User]: ...

    @abstractmethod
    def get_by_id(self, user_id: str) -> Optional[User]: ...


class AdminActionLogRepository(ABC):
    """Audit trail for admin actions."""

    @abstractmethod
    def add(self, log: AdminActionLog) -> AdminActionLog: ...

    @abstractmethod
    def list(
        self,
        *,
        admin_id: Optional[str] = None,
        target_user_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> list[AdminActionLog]: ...

    @abstractmethod
    def count(
        self,
        *,
        admin_id: Optional[str] = None,
        target_user_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> int: ...


# =============================================================================
# CHAT / MESSAGING PORTS
# =============================================================================

class TranslationClient(ABC):
    """Port for translation service (DeepL, Google, etc.)."""

    @abstractmethod
    async def translate(self, text: str, target_lang: str, source_lang: str = "auto") -> str:
        """Translate text to target language."""

    @abstractmethod
    async def detect_language(self, text: str) -> str:
        """Detect the language of text."""


class ChatGroupRepository(ABC):
    """Chat group persistence."""

    @abstractmethod
    def add(self, group: ChatGroup) -> ChatGroup: ...

    @abstractmethod
    def get(self, group_id: str) -> Optional[ChatGroup]: ...

    @abstractmethod
    def list_for_user(self, user_id: str) -> list[ChatGroup]: ...

    @abstractmethod
    def list_by_type(self, group_type: str, org_id: Optional[str] = None) -> list[ChatGroup]: ...

    @abstractmethod
    def update(self, group_id: str, **fields) -> Optional[ChatGroup]: ...

    @abstractmethod
    def delete(self, group_id: str) -> bool: ...


class GroupParticipantRepository(ABC):
    """Group participant persistence."""

    @abstractmethod
    def add(self, participant: GroupParticipant) -> GroupParticipant: ...

    @abstractmethod
    def get(self, group_id: str, user_id: str) -> Optional[GroupParticipant]: ...

    @abstractmethod
    def list_for_group(self, group_id: str) -> list[GroupParticipant]: ...

    @abstractmethod
    def list_for_user(self, user_id: str) -> list[GroupParticipant]: ...

    @abstractmethod
    def update(self, group_id: str, user_id: str, **fields) -> Optional[GroupParticipant]: ...

    @abstractmethod
    def remove(self, group_id: str, user_id: str) -> bool: ...


class ChatMessageRepository(ABC):
    """Chat message persistence."""

    @abstractmethod
    def add(self, message: ChatMessage) -> ChatMessage: ...

    @abstractmethod
    def get(self, message_id: str) -> Optional[ChatMessage]: ...

    @abstractmethod
    def list_for_group(
        self,
        group_id: str,
        *,
        limit: int = 50,
        before: Optional[str] = None,
        after: Optional[str] = None,
    ) -> list[ChatMessage]: ...

    @abstractmethod
    def list_direct(
        self,
        user1_id: str,
        user2_id: str,
        *,
        limit: int = 50,
        before: Optional[str] = None,
    ) -> list[ChatMessage]: ...

    @abstractmethod
    def update(self, message_id: str, **fields) -> Optional[ChatMessage]: ...

    @abstractmethod
    def soft_delete(self, message_id: str) -> bool: ...

    @abstractmethod
    def mark_read(self, group_id: str, user_id: str, message_id: str) -> None: ...


class DirectChatRepository(ABC):
    """Direct (1-on-1) chat persistence."""

    @abstractmethod
    def get_or_create(self, user1_id: str, user2_id: str) -> DirectChat: ...

    @abstractmethod
    def get(self, user1_id: str, user2_id: str) -> Optional[DirectChat]: ...

    @abstractmethod
    def list_for_user(self, user_id: str) -> list[DirectChat]: ...

    @abstractmethod
    def update_last_message(self, user1_id: str, user2_id: str, message_id: str) -> None: ...


class UserChatSettingsRepository(ABC):
    """User chat settings persistence."""

    @abstractmethod
    def get(self, user_id: str) -> Optional[UserChatSettings]: ...

    @abstractmethod
    def upsert(self, settings: UserChatSettings) -> UserChatSettings: ...