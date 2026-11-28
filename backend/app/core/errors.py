"""Domain/infrastructure error types shared across layers."""


class DomainError(Exception):
    """Base for application/domain rule violations."""


class PlacementNotFound(DomainError):
    """No placement exists with the requested id."""


class PlacementNotOpen(DomainError):
    """The placement exists but is Closed and can't accept new applications."""


class LLMNotConfigured(RuntimeError):
    """Raised when the advisor is called but Groq is not configured."""


class VoiceNotConfigured(RuntimeError):
    """Raised when the voice service is called but DeepL is not configured."""


class TranslationNotConfigured(RuntimeError):
    """Raised when the translation service is called but DeepL is not configured."""


class AuthenticationError(DomainError):
    """Bad credentials or an invalid/expired token (maps to HTTP 401)."""


class InvalidCredentials(AuthenticationError):
    """Email/password did not match any account."""


class EmailAlreadyExists(DomainError):
    """Registration attempted with an email that is already taken."""


class UserNotFound(DomainError):
    """No account exists with the requested id."""


class LearningResourceNotFound(DomainError):
    """No learning resource exists with the requested id."""


class ApplicationDeadlinePassed(DomainError):
    """The placement's application deadline has passed."""


class NoSlotsAvailable(DomainError):
    """The placement has no remaining slots."""


class ApplicationLimitExceeded(DomainError):
    """The student has exceeded their monthly application allowance."""

    def __init__(self, current: int, limit: int, unpaid_invoice=None, reason: str = "") -> None:
        self.current = current
        self.limit = limit
        self.unpaid_invoice = unpaid_invoice
        self.reason = reason
        super().__init__(reason or "Application limit exceeded")
    """The student does not meet a placement's eligibility requirements."""

    def __init__(self, placement_id: str, reasons: str) -> None:
        self.placement_id = placement_id
        self.reasons = reasons
        super().__init__(f"Not eligible for placement {placement_id}: {reasons}")



class NotEligible(DomainError):
    """The student does not meet a placement's eligibility requirements."""

    def __init__(self, placement_id: str, reasons: str) -> None:
        self.placement_id = placement_id
        self.reasons = reasons
        super().__init__(f"Not eligible for placement {placement_id}: {reasons}")
