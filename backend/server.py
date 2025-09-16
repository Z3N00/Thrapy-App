from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, Field, EmailStr
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from emergentintegrations.llm.chat import LlmChat, UserMessage
import os
import logging
import uuid
import jwt
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
JWT_SECRET = "thrapy_secret_key_2024"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_TIME_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app without a prefix
app = FastAPI(title="Thrapy API", description="AI and Licensed Therapist Platform")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "client"  # client, therapist, or admin

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    created_at: datetime

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TherapistRegistration(BaseModel):
    license_number: str
    specialization: str
    hourly_rate: float
    bio: str
    years_experience: int

class TherapistProfile(BaseModel):
    id: str
    user_id: str
    license_number: str
    specialization: str
    hourly_rate: float
    bio: str
    years_experience: int
    is_available: bool = True
    created_at: datetime

class AvailabilitySlot(BaseModel):
    day_of_week: int  # 0-6 (Monday-Sunday)
    start_time: str  # "09:00"
    end_time: str    # "17:00"

class TherapistAvailability(BaseModel):
    therapist_id: str
    availability: List[AvailabilitySlot]

class SessionBase(BaseModel):
    session_type: str  # "ai" or "therapist"
    scheduled_date: Optional[datetime] = None
    duration_minutes: int = 60
    cost: float

class SessionCreate(SessionBase):
    therapist_id: Optional[str] = None

class SessionResponse(SessionBase):
    id: str
    user_id: str
    therapist_id: Optional[str] = None
    status: str = "scheduled"  # scheduled, completed, cancelled
    created_at: datetime

class ChatMessage(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    response: str
    session_id: str

class PaymentRecord(BaseModel):
    id: str
    user_id: str
    session_id: str
    amount: float
    payment_type: str  # "ai_session" or "therapist_session"
    status: str = "completed"
    platform_fee: Optional[float] = None
    therapist_earnings: Optional[float] = None
    created_at: datetime

# Utility Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_TIME_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return UserResponse(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: UserResponse = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Authentication Routes
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(user.password)
    
    user_doc = {
        "id": user_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "password_hash": hashed_password,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    # Create token
    access_token = create_access_token(data={"sub": user_id})
    
    user_response = UserResponse(
        id=user_id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        created_at=user_doc["created_at"]
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user_login: UserLogin):
    user = await db.users.find_one({"email": user_login.email})
    if not user or not verify_password(user_login.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        created_at=user["created_at"]
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

# Therapist Routes
@api_router.post("/therapist/register", response_model=TherapistProfile)
async def register_therapist(
    therapist_data: TherapistRegistration,
    current_user: UserResponse = Depends(get_current_user)
):
    if current_user.role != "therapist":
        raise HTTPException(status_code=403, detail="Only therapists can register as therapists")
    
    # Check if therapist profile already exists
    existing_therapist = await db.therapists.find_one({"user_id": current_user.id})
    if existing_therapist:
        raise HTTPException(status_code=400, detail="Therapist profile already exists")
    
    therapist_id = str(uuid.uuid4())
    therapist_doc = {
        "id": therapist_id,
        "user_id": current_user.id,
        "license_number": therapist_data.license_number,
        "specialization": therapist_data.specialization,
        "hourly_rate": therapist_data.hourly_rate,
        "bio": therapist_data.bio,
        "years_experience": therapist_data.years_experience,
        "is_available": True,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.therapists.insert_one(therapist_doc)
    
    return TherapistProfile(**therapist_doc)

@api_router.get("/therapists", response_model=List[TherapistProfile])
async def get_therapists():
    therapists = await db.therapists.find({"is_available": True}).to_list(100)
    return [TherapistProfile(**therapist) for therapist in therapists]

@api_router.post("/therapist/availability")
async def set_availability(
    availability: TherapistAvailability,
    current_user: UserResponse = Depends(get_current_user)
):
    therapist = await db.therapists.find_one({"user_id": current_user.id})
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist profile not found")
    
    availability_doc = {
        "therapist_id": therapist["id"],
        "availability": [slot.dict() for slot in availability.availability],
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.therapist_availability.replace_one(
        {"therapist_id": therapist["id"]},
        availability_doc,
        upsert=True
    )
    
    return {"message": "Availability updated successfully"}

# Session Routes
@api_router.post("/sessions/create", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    session_id = str(uuid.uuid4())
    
    # Calculate cost based on session type
    if session_data.session_type == "ai":
        cost = 5.0 * (session_data.duration_minutes / 60)  # $5 per hour
    elif session_data.session_type == "therapist":
        if not session_data.therapist_id:
            raise HTTPException(status_code=400, detail="Therapist ID required for therapist sessions")
        
        therapist = await db.therapists.find_one({"id": session_data.therapist_id})
        if not therapist:
            raise HTTPException(status_code=404, detail="Therapist not found")
        
        cost = therapist["hourly_rate"] * (session_data.duration_minutes / 60)
    else:
        raise HTTPException(status_code=400, detail="Invalid session type")
    
    session_doc = {
        "id": session_id,
        "user_id": current_user.id,
        "therapist_id": session_data.therapist_id,
        "session_type": session_data.session_type,
        "scheduled_date": session_data.scheduled_date,
        "duration_minutes": session_data.duration_minutes,
        "cost": cost,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.sessions.insert_one(session_doc)
    
    # Create payment record
    payment_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "session_id": session_id,
        "amount": cost,
        "payment_type": f"{session_data.session_type}_session",
        "status": "completed",
        "created_at": datetime.now(timezone.utc)
    }
    
    if session_data.session_type == "therapist":
        platform_fee = cost * 0.30  # 30% platform fee
        therapist_earnings = cost * 0.70  # 70% to therapist
        payment_doc["platform_fee"] = platform_fee
        payment_doc["therapist_earnings"] = therapist_earnings
    
    await db.payments.insert_one(payment_doc)
    
    return SessionResponse(**session_doc)

@api_router.get("/sessions", response_model=List[SessionResponse])
async def get_user_sessions(current_user: UserResponse = Depends(get_current_user)):
    sessions = await db.sessions.find({"user_id": current_user.id}).to_list(100)
    return [SessionResponse(**session) for session in sessions]

# AI Chat Routes
@api_router.post("/ai-chat", response_model=ChatResponse)
async def ai_chat(
    chat_message: ChatMessage,
    current_user: UserResponse = Depends(get_current_user)
):
    # Verify session exists
    session = await db.sessions.find_one({
        "id": chat_message.session_id,
        "user_id": current_user.id,
        "session_type": "ai"
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="AI session not found")
    
    try:
        # Initialize AI chat
        chat = LlmChat(
            api_key=os.environ.get("EMERGENT_LLM_KEY"),
            session_id=chat_message.session_id,
            system_message="You are a compassionate and professional AI therapist. Provide supportive, empathetic responses while maintaining appropriate boundaries. Help users explore their thoughts and feelings in a safe environment."
        ).with_model("openai", "gpt-4o-mini")
        
        # Create user message
        user_message = UserMessage(text=chat_message.message)
        
        # Get AI response
        response = await chat.send_message(user_message)
        
        # Store message history
        message_doc = {
            "id": str(uuid.uuid4()),
            "session_id": chat_message.session_id,
            "user_id": current_user.id,
            "user_message": chat_message.message,
            "ai_response": response,
            "timestamp": datetime.now(timezone.utc)
        }
        
        await db.chat_history.insert_one(message_doc)
        
        return ChatResponse(
            response=response,
            session_id=chat_message.session_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")

@api_router.get("/sessions/{session_id}/chat-history")
async def get_chat_history(
    session_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    # Verify session belongs to user
    session = await db.sessions.find_one({
        "id": session_id,
        "user_id": current_user.id
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    history = await db.chat_history.find({"session_id": session_id}).to_list(1000)
    return history

# Payment Routes
@api_router.get("/payments/history", response_model=List[PaymentRecord])
async def get_payment_history(current_user: UserResponse = Depends(get_current_user)):
    payments = await db.payments.find({"user_id": current_user.id}).to_list(100)
    return [PaymentRecord(**payment) for payment in payments]

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()