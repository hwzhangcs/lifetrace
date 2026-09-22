from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Code = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
ID = Annotated[int, Field(gt=0)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class UserIn(Input):
    name: Name
    role: Literal["TECHNICIAN", "MANAGER"] = "TECHNICIAN"


class AssetIn(Input):
    asset_code: Code
    asset_type: Code
    model_name: Name
    acquired_at: date | None = None


class SlotIn(Input):
    slot_name: Code
    allowed_type: Code


class ModelIn(Input):
    component_type: Code
    manufacturer: Name
    model_name: Name
    description: str = Field(default="", max_length=2000)


class BatchIn(Input):
    component_model_id: ID
    batch_code: Code
    manufactured_at: date | None = None


class ComponentIn(Input):
    serial_no: Code
    batch_id: ID
    condition_status: Literal["GOOD", "DEFECTIVE", "RETIRED"] = "GOOD"


class MaintenanceIn(Input):
    asset_id: ID
    slot_id: ID
    technician_id: ID
    note: str = Field(default="", max_length=2000)


class InstallIn(MaintenanceIn):
    new_component_id: ID


class RemoveIn(MaintenanceIn):
    expected_installation_id: ID


class SwapIn(RemoveIn):
    new_component_id: ID


class RecallIn(Input):
    technician_id: ID
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
