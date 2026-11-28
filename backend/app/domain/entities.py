"""Domain entities — re-exported from bounded-context modules.

Kept as a single import surface for backward compatibility. New code should
import from the specific context module (e.g. ``app.domain.placements``).
"""
from app.domain.identity import (  # noqa: F401
    USER_ROLES,
    User,
    AdminActionLog,
)
from app.domain.billing import (  # noqa: F401
    Subscription,
    Invoice,
    Transaction,
    StudentUsage,
)
from app.domain.chat import (  # noqa: F401
    ChatType,
    MessageType,
    GroupType,
    ChatGroup,
    GroupParticipant,
    ChatMessage,
    DirectChat,
    UserChatSettings,
)
from app.domain.placements import (  # noqa: F401
    Organisation,
    Placement,
    Job,
    APPLICATION_STATUSES,
    StudentProfile,
    Resume,
    StudentDocument,
    Application,
    JobApplication,
    ApplicationPack,
    LearningResource,
)
from app.domain.matching import (  # noqa: F401
    ProficiencyLevel,
    CareerStage,
    SkillCompetency,
    SoftSkillProfile,
    CareerTrajectory,
    CulturalValues,
    AdvancedStudentProfile,
    AdvancedPlacementProfile,
)