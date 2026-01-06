Here is the consolidated **Project State & Code Context** for your "MotionX Director" application. This summary captures the final state of our architectural decisions and the latest working code for the critical files we built together.

### **1. Project Architecture**

* **Goal:** A multi-user platform to manage anime series, parse scripts from Excel, assign AI emotions, cast voice actors, and generate audio lines using ElevenLabs.
* **Stack:**
* **Frontend:** React (Vite) + Tailwind CSS + React Query.
* **Backend:** Python FastAPI.
* **Database:** Firebase Firestore (NoSQL).
* **AI:** OpenAI (Emotion Analysis) + ElevenLabs (Text-to-Speech).



---

### **2. Final Backend Code**

**File:** `backend/main.py`
*Features: Series/Episode CRUD, Excel Parsing, OpenAI Analysis, ElevenLabs Streaming (v2 Model).*

```python
import os
import pandas as pd
import json
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from openai import OpenAI
from io import BytesIO
from datetime import datetime
from dotenv import load_dotenv
import requests
import firebase_admin
from firebase_admin import credentials, firestore

# 1. Setup
load_dotenv() 
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_credentials.json") 
    firebase_admin.initialize_app(cred)

db = firestore.client()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# --- DATA MODELS ---
class ScriptLine(BaseModel):
    id: str
    panel_number: int
    dialogue: str
    action: str
    sfx: str
    characters: List[str]

class TagRequest(BaseModel):
    lines: List[ScriptLine]

class SeriesModel(BaseModel):
    title: str
    description: Optional[str] = ""

class EpisodeModel(BaseModel):
    title: str
    status: Optional[str] = "Draft"

# --- ENDPOINTS ---

@app.get("/")
def health_check():
    return {"status": "MotionX Director Backend is running"}

# 1. UPLOAD EXCEL
@app.post("/upload")
async def parse_excel(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents))
        
        required_cols = ['panel_number', 'merged_dialogues', 'action_description', 'sfx_keywords', 'characters_included']
        if not all(col in df.columns for col in required_cols):
             raise HTTPException(status_code=400, detail="Missing required columns.")

        script_data = []
        for idx, row in df.iterrows():
            try:
                dialogues = json.loads(row['merged_dialogues']) if pd.notna(row['merged_dialogues']) else []
                chars = json.loads(row['characters_included']) if pd.notna(row['characters_included']) else []
                action = str(row['action_description']) if pd.notna(row['action_description']) else ""
                sfx = str(row['sfx_keywords']) if pd.notna(row['sfx_keywords']) else ""
                
                for i, text in enumerate(dialogues):
                    script_data.append({
                        "id": f"{row['panel_number']}_{i}",
                        "panel_number": row['panel_number'],
                        "dialogue": text,
                        "action": action,
                        "sfx": sfx,
                        "characters": chars,
                        "suggested_emotion": ""
                    })
            except Exception:
                continue

        return {"filename": file.filename, "total_lines": len(script_data), "data": script_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. AI EMOTION ANALYSIS
@app.post("/analyze_emotions")
async def analyze_emotions_batch(payload: TagRequest):
    try:
        lines = payload.lines
        if not lines: return {}

        user_content = "Analyze these lines and provide JSON mapping {id: [Emotion]}:\n"
        for line in lines:
            user_content += f"ID: {line.id} | Context: {line.action} | Dialogue: {line.dialogue}\n"

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a Voice Director. Return JSON object: key=line_id, value=Emotion Tag (e.g. [Angry], [Sad])."},
                {"role": "user", "content": user_content}
            ],
            response_format={ "type": "json_object" }
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. GET VOICES
@app.get("/voices")
async def get_voices():
    docs = db.collection("voices").stream()
    return {"voices": sorted([doc.to_dict() for doc in docs], key=lambda x: x['name'])}

# 4. SERIES CRUD
@app.get("/series")
async def get_all_series():
    docs = db.collection("series").stream()
    return {"series": [doc.to_dict() for doc in docs]}

@app.post("/series")
async def create_series(series: SeriesModel):
    doc_ref = db.collection("series").document()
    data = {
        "id": doc_ref.id,
        "title": series.title,
        "description": series.description,
        "created_at": firestore.SERVER_TIMESTAMP
    }
    doc_ref.set(data)
    response_data = data.copy()
    response_data["created_at"] = datetime.now().isoformat()
    return {"status": "success", "id": doc_ref.id, "data": response_data}

@app.delete("/series/{series_id}")
async def delete_series(series_id: str):
    db.collection("series").document(series_id).delete()
    return {"status": "success"}

# 5. EPISODE CRUD
@app.get("/series/{series_id}/episodes")
async def get_episodes(series_id: str):
    docs = db.collection("series").document(series_id).collection("episodes").stream()
    return {"episodes": [doc.to_dict() for doc in docs]}

@app.post("/series/{series_id}/episodes")
async def create_episode(series_id: str, episode: EpisodeModel):
    ep_ref = db.collection("series").document(series_id).collection("episodes").document()
    data = {
        "id": ep_ref.id,
        "title": episode.title,
        "status": episode.status,
        "created_at": firestore.SERVER_TIMESTAMP,
        "series_id": series_id
    }
    ep_ref.set(data)
    response_data = data.copy()
    response_data["created_at"] = datetime.now().isoformat()
    return {"status": "success", "id": ep_ref.id, "data": response_data}

@app.delete("/series/{series_id}/episodes/{episode_id}")
async def delete_episode(series_id: str, episode_id: str):
    db.collection("series").document(series_id).collection("episodes").document(episode_id).delete()
    return {"status": "success"}

# 6. GENERATE AUDIO (ElevenLabs)
@app.post("/generate_audio")
async def generate_audio(payload: dict = Body(...)):
    text = payload.get("text")
    voice_id = payload.get("voice_id")
    
    if not text or not voice_id:
        raise HTTPException(status_code=400, detail="Missing text or voice_id")

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {"xi-api-key": os.getenv("ELEVENLABS_API_KEY"), "Content-Type": "application/json"}
    data = {
        "text": text,
        "model_id": "eleven_multilingual_v2", # Updated Model
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}
    }
    
    response = requests.post(url, json=data, headers=headers, stream=True)
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=response.text)
        
    return StreamingResponse(BytesIO(response.content), media_type="audio/mpeg")

```

---

### **3. Final Frontend Code**

#### **A. `Dashboard.jsx` (Series List)**

*Features: List Series, Admin Create/Delete.*

```javascript
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Plus, X, Film, Loader2, Trash2 } from 'lucide-react';

const API_URL = "http://127.0.0.1:8000";

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const queryClient = useQueryClient();

  const { data: seriesList, isLoading } = useQuery({
    queryKey: ['series'],
    queryFn: async () => (await axios.get(`${API_URL}/series`)).data.series
  });

  const createMutation = useMutation({
    mutationFn: async (title) => axios.post(`${API_URL}/series`, { title }),
    onSuccess: () => { queryClient.invalidateQueries(['series']); setShowModal(false); setNewTitle(""); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => axios.delete(`${API_URL}/series/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['series'])
  });

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if(confirm("Delete this series?")) deleteMutation.mutate(id);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header omitted for brevity */}
      <div className="grid grid-cols-3 gap-6">
        {user?.role === 'admin' && (
          <button onClick={() => setShowModal(true)} className="border-2 border-dashed h-48 flex flex-col items-center justify-center rounded-xl hover:bg-indigo-50 text-slate-500">
            <Plus className="mb-2"/> Create Series
          </button>
        )}
        {seriesList?.map(s => (
          <div key={s.id} onClick={() => navigate(`/series/${s.id}`)} className="bg-white p-6 rounded-xl shadow border relative group cursor-pointer">
            {user?.role === 'admin' && <button onClick={(e) => handleDelete(e, s.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>}
            <h3 className="font-bold text-xl">{s.title}</h3>
            <p className="text-xs text-slate-400 mt-2">ID: {s.id}</p>
          </div>
        ))}
      </div>
      {/* Modal code omitted (same as previous) */}
    </div>
  );
}

```

#### **B. `SeriesDetails.jsx` (Episode List)**

*Features: List Episodes, Admin Create (with Redirect)/Delete.*

```javascript
// ... Imports omitted
export function SeriesDetails() {
  const { seriesId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState("");

  const { data: episodes } = useQuery({
    queryKey: ['episodes', seriesId],
    queryFn: async () => (await axios.get(`${API_URL}/series/${seriesId}/episodes`)).data.episodes
  });

  const createMutation = useMutation({
    mutationFn: async (title) => axios.post(`${API_URL}/series/${seriesId}/episodes`, { title }),
    onSuccess: (res) => {
       queryClient.invalidateQueries(['episodes', seriesId]);
       navigate(`/series/${seriesId}/episode/${res.data.id}`); // AUTO REDIRECT
    }
  });

  // ... Delete logic & UI Grid (Same structure as Dashboard but for Episodes)
}

```

#### **C. `EpisodeDirector.jsx` (The Main Tool Wrapper)**

*Features: Upload Excel, Casting Modal (Global Voice Map).*

```javascript
// ... Imports
export function EpisodeDirector() {
  const { seriesId, episodeId } = useParams();
  const [scriptData, setScriptData] = useState(null);
  const [showCastingModal, setShowCastingModal] = useState(false);
  const [characterMap, setCharacterMap] = useState({});

  const { data: voices } = useQuery({ queryKey: ['voices'], queryFn: async () => (await axios.get(`${API_URL}/voices`)).data.voices });

  const uploadMutation = useMutation({
    mutationFn: uploadExcel,
    onSuccess: (data) => { setScriptData(data.data); setShowCastingModal(true); }
  });

  const applyVoicesToScript = () => {
    const updated = scriptData.map(line => ({
        ...line,
        voice_id: characterMap[line.characters[0]] || line.voice_id
    }));
    setScriptData(updated);
    setShowCastingModal(false);
  };

  // ... UI: Renders <DirectorTable data={scriptData} availableVoices={voices} />
  // ... UI: Renders Casting Modal
}

```

#### **D. `DirectorTable.jsx` (The Brain)**

*Features: Audio Generation (w/ Emotion Injection), Playback, Download, Emotion Analysis.*

```javascript
// ... Imports
export function DirectorTable({ data, availableVoices }) {
  // ... State (scriptLines, audioMap, range)
  
  const handleGenerateAudio = (line) => {
    if (!line.voice_id) return alert("Select Voice!");
    
    // INJECT EMOTION TAG
    let text = line.dialogue;
    if (line.suggested_emotion) {
        const tag = line.suggested_emotion.replace(/[\[\]]/g, '');
        text = `[${tag}] ${line.dialogue}`;
    }

    audioMutation.mutate({ lineId: line.id, text, voiceId: line.voice_id });
  };

  // ... Render Table with Audio Column (Play/Download buttons)
}

```