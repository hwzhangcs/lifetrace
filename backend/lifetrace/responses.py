"""Public response contracts; OpenAPI is the frontend type source."""

from datetime import date, datetime

from pydantic import BaseModel


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class Items[T](BaseModel):
    items: list[T]


class Asset(BaseModel):
    id: int
    asset_code: str
    asset_type: str
    model_name: str
    status: str
    acquired_at: date | None
    created_at: datetime


class User(BaseModel):
    id: int
    name: str
    role: str
    created_at: datetime


class Model(BaseModel):
    id: int
    component_type: str
    manufacturer: str
    model_name: str
    description: str


class Batch(BaseModel):
    id: int
    component_model_id: int
    batch_code: str
    manufactured_at: date | None
    recall_status: str
    recalled_at: datetime | None
    recalled_by: int | None
    recall_reason: str | None
    model_name: str | None = None
    component_type: str | None = None


class Component(BaseModel):
    id: int
    serial_no: str
    batch_id: int
    condition_status: str
    created_at: datetime
    batch_code: str | None = None
    recall_status: str | None = None
    component_type: str | None = None
    model_name: str | None = None
    installation_id: int | None = None
    asset_code: str | None = None
    slot_name: str | None = None


class Slot(BaseModel):
    id: int
    asset_id: int
    slot_name: str
    allowed_type: str
    created_at: datetime


class CompositionSlot(BaseModel):
    slot_id: int
    slot_name: str
    allowed_type: str
    installation_id: int | None
    component_id: int | None
    serial_no: str | None
    condition_status: str | None
    batch_code: str | None
    recall_status: str | None
    installed_at: datetime | None
    removed_at: datetime | None


class Composition(BaseModel):
    items: list[CompositionSlot]
    at: datetime | None
    mode: str


class Event(BaseModel):
    id: int
    asset_id: int
    technician_id: int
    event_type: str
    occurred_at: datetime
    note: str


class Maintenance(BaseModel):
    event: Event
    components: list[CompositionSlot]


class HistoryComponent(Component):
    manufactured_at: date | None
    recalled_at: datetime | None
    recall_reason: str | None
    recalled_by: int | None


class HistoryEvent(BaseModel):
    action: str
    occurred_at: datetime
    technician: str
    note: str
    id: int | None = None
    event_type: str | None = None
    asset_id: int | None = None
    asset_code: str | None = None
    slot_name: str | None = None


class History(BaseModel):
    component: HistoryComponent
    items: list[HistoryEvent]


class Exposure(BaseModel):
    asset_id: int
    asset_code: str
    model_name: str
    component_id: int
    serial_no: str
    slot_name: str
    installed_at: datetime
    removed_at: datetime | None


class AffectedAsset(BaseModel):
    asset_id: int
    asset_code: str
    model_name: str
    exposures: list[Exposure]


class Impact(BaseModel):
    items: list[AffectedAsset]
    total: int


class RecentEvent(Event):
    asset_code: str
    technician: str


class Counts(BaseModel):
    assets: int
    components: int
    recalled_batches: int
    affected_assets: int


class Dashboard(BaseModel):
    counts: Counts
    recent: list[RecentEvent]


class ErrorField(BaseModel):
    field: str
    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    fields: list[ErrorField] | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
