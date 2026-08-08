from __future__ import annotations
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional


# Auth
class RegisterRequest(BaseModel):
    full_name: str
    email: str
    phone: str
    region: str
    home_address: str
    password: str

class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str

class ResendOTPRequest(BaseModel):
    phone: str

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    token: str
    user: dict

# User
class UserProfile(BaseModel):
    user_id: str
    full_name: str
    email: str
    phone: str
    region: str
    home_address: str
    nkwa_id: str
    role: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    region: Optional[str] = None
    home_address: Optional[str] = None

# Contacts
class Contact(BaseModel):
    contact_id: str
    user_id: str
    full_name: str
    relationship: str
    phone: str
    email: Optional[str] = None
    notify: bool = True

class AddContactRequest(BaseModel):
    full_name: str
    relationship: str
    phone: str
    email: Optional[str] = None

class UpdateContactRequest(BaseModel):
    full_name: Optional[str] = None
    relationship: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notify: Optional[bool] = None

# Call Pipeline
class CallInitiateRequest(BaseModel):
    service_type: str  # AMBULANCE | FIRE | POLICE | SOS
    language: str      # tw | ee | dag | gaa | fat | kus | en
    gps_lat: float
    gps_lon: float
    audio_base64: str

class CallInitiateResponse(BaseModel):
    call_id: str
    status: str
    first_aid_audio_url: Optional[str] = None

class CallStatusResponse(BaseModel):
    call_id: str
    status: str
    first_aid_audio_url: Optional[str] = None
    first_aid_text: Optional[str] = None

class TriageDecision(BaseModel):
    severity: Literal["CRITICAL", "URGENT", "NON_EMERGENCY"]
    call_classification: Literal["REAL_EMERGENCY", "PRANK", "UNCERTAIN"]
    incident_type: Optional[str] = None
    is_prank: bool = False
    prank_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    dispatcher_brief: str
    recommended_response_unit: Literal["AMBULANCE", "FIRE", "POLICE", "NONE"]
    triage_model_id: Optional[str] = None

    @field_validator("severity", "call_classification", "recommended_response_unit", mode="before")
    @classmethod
    def normalize_enum(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper().replace("-", "_").replace(" ", "_")
        return value

class KnowledgeSnippet(BaseModel):
    source_id: str
    text: str
    score: Optional[float] = None
    source_uri: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    knowledge_source: Literal["bedrock_kb", "local_fallback", "mock"] = "bedrock_kb"

class FirstAidGuidance(BaseModel):
    first_aid_script: str
    first_aid_script_translated: Optional[str] = None
    source_ids: list[str] = Field(default_factory=list)
    source_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    knowledge_source: Literal["bedrock_kb", "local_fallback", "mock"] = "local_fallback"
    knowledge_source_ids: list[str] = Field(default_factory=list)
    kb_result_scores: list[float] = Field(default_factory=list)
    first_aid_model_id: Optional[str] = None

# SOS
class SOSRequest(BaseModel):
    gps_lat: float
    gps_lon: float
    message: Optional[str] = "SOS triggered"

class SOSResponse(BaseModel):
    sos_id: str
    contacts_alerted: int
    dispatcher_notified: bool

# Generic
class MessageResponse(BaseModel):
    message: str
