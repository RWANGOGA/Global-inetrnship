"""Domain/infrastructure error types shared across layers."""


class DomainError(Exception):
    """Base for application/domain rule violations."""


class PlacementNotFound(DomainError):
    """No placement exists with the requested id."""


class PlacementNotOpen(DomainError):
    """The placement exists but is Closed and can't accept new applications."""


class LLMNotConfigured(RuntimeError):
    """Raised when the advisor is called but Groq is not configured."""


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

