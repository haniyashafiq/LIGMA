"""
LIGMA AI Chatbot – FastAPI backend
Communicates with the AI Assistant UI on the Vite frontend.

Run:
    uvicorn main:app --reload --port 8000
"""

import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional

# ── LangChain imports ────────────────────────────────────────────────
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# ── App setup ────────────────────────────────────────────────────────
app = FastAPI(title="LIGMA Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server
        os.getenv("CLIENT_URL", ""),   # production origin from .env
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Gemini LLM ───────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

llm = None
if GOOGLE_API_KEY:
    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-flash-latest",
            google_api_key=GOOGLE_API_KEY,
            temperature=0.7,
        )
    except Exception as e:
        print(f"Error initializing Gemini LLM: {e}")
        llm = None

# ── Request / Response models ────────────────────────────────────────

FEW_SHOT_EXAMPLES = [
    {"input": "I will finish the backend integration for the login module by tomorrow morning.", "output": "action item"},
    {"input": "Where can I find the latest API documentation for the project?", "output": "open question"},
    {"input": "We have officially agreed to use MongoDB for our database layer.", "output": "decision"},
    {"input": "The current server response time is averaging 120ms under load.", "output": "reference"},
    {"input": "Hey team, just wanted to say everyone is doing a great job!", "output": "general"},
    {"input": "Please add a 'Forgot Password' link to the main landing page.", "output": "action item"},
    {"input": "It's probably time we looked into optimizing our SQL queries.", "output": "action item"},
    {"input": "I'm not sure if the client is okay with the current color scheme.", "output": "open question"},
    {"input": "I guess that settles it—we'll stick with the original design.", "output": "decision"},
    {"input": "The UI designer mentioned that the buttons look a bit too small on mobile.", "output": "reference"},
    {"input": "Testing, testing. Is the live update feature working on your end?", "output": "general"},
    {"input": "Maybe a progress bar would help users during the upload process.", "output": "open question"}
]

class IntentCategory(str, Enum):
    ACTION = "action item"
    DECISION = "decision"
    OPEN_QUESTION = "open question"
    REFERENCE = "reference"
    GENERAL = "general"

class TaskStatus(str, Enum):
    TODO = "todo"
    DOING = "doing"
    DONE = "done"

class IntentAnalysis(BaseModel):
    """Analysis of the user's intent in their statement."""
    category: IntentCategory = Field(description="The category the statement belongs to")
    status: Optional[TaskStatus] = Field(default=TaskStatus.TODO, description="If it's an action item, what is its status?")
    confidence: float = Field(description="Confidence score between 0 and 1")

class ChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None   # optional conversation history


class ChatResponse(BaseModel):
    reply: str
    intent: Optional[str] = None
    status: Optional[str] = "todo"


# ── Routes ───────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "llm_ready": llm is not None}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    print(f"Received message: {req.message}")
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    if llm is None:
        return ChatResponse(
            reply="⚠️ AI Backend Not Configured",
            intent="error"
        )

    try:
        print(f"Classifying intent for message...")
        messages = [
            SystemMessage(content=(
                "You are an intent classifier and task manager. Categorize user statements into: "
                "action item, decision, open question, reference, or general. "
                "If it is an 'action item', also determine its status: 'todo', 'doing', or 'done'. "
                "Default status is 'todo' unless the text implies work is in progress or completed. "
                "Use the provided examples to guide your classification."
            ))
        ]
        
        for ex in FEW_SHOT_EXAMPLES:
            messages.append(HumanMessage(content=ex["input"]))
            messages.append(AIMessage(content=ex["output"]))
            
        messages.append(HumanMessage(content=req.message))

        structured_llm = llm.with_structured_output(IntentAnalysis)
        analysis = await structured_llm.ainvoke(messages)
        
        intent_category = analysis.category.value
        status = analysis.status.value if analysis.status else "todo"
        print(f"Detected intent: {intent_category}, status: {status}")

        return ChatResponse(
            reply=intent_category,
            intent=intent_category,
            status=status
        )
        
    except Exception as e:
        print(f"CRITICAL Error invoking LLM: {type(e).__name__}: {e}")
        return ChatResponse(
            reply=f"⚠️ AI Backend Error: {type(e).__name__}",
            intent="error",
            status="todo"
        )
