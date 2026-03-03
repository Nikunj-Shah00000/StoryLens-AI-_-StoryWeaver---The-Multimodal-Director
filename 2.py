import os
import asyncio
import json
import uuid
from typing import AsyncGenerator, Optional, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import google.generativeai as genai
from google.cloud import storage, firestore
from google.cloud.aiplatform import telemetry
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel, VideoGenerationModel
import logging
import traceback
from datetime import datetime
import redis.asyncio as redis
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="StoryWeaver API", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Google Cloud clients
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "storyweaver-project")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
BUCKET_NAME = os.getenv("GCS_BUCKET", f"{PROJECT_ID}-story-assets")

# Initialize Vertex AI
vertexai.init(project=PROJECT_ID, location=LOCATION)

# Initialize Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel('gemini-1.5-pro-001')

# Initialize GCS
storage_client = storage.Client()
bucket = storage_client.bucket(BUCKET_NAME)

# Initialize Firestore
db = firestore.AsyncClient(project=PROJECT_ID)

# Initialize Redis for session management
redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

# Pydantic models
class DirectorRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    style: str = "cinematic"
    tone: str = "neutral"
    include_video: bool = False
    pacing: str = "balanced"

class StoryResponse(BaseModel):
    session_id: str
    content: str
    assets: list
    timestamp: datetime

# ADK Agent Implementation
class StoryWeaverAgent:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.context = []
        self.style_profile = {}
        self.generation_queue = asyncio.Queue()
        
    async def process_prompt(self, request: DirectorRequest) -> AsyncGenerator[str, None]:
        """Main agent loop - processes user prompt and generates interleaved output"""
        
        # Build the system prompt for Gemini with interleaved output instructions
        system_prompt = f"""
        You are StoryWeaver, an AI creative director. Your task is to create a rich, 
        interleaved multimedia narrative. You will output text, but at key moments, 
        you will trigger image and video generation using special tags.
        
        Current Directorial Settings:
        - Visual Style: {request.style}
        - Narrative Tone: {request.tone}
        - Pacing: {request.pacing}
        
        RULES FOR INTERLEAVED OUTPUT:
        1. Write compelling narrative text
        2. When you want to generate an image, use: [GENERATE_IMAGE: detailed prompt for the image]
        3. For key cinematic moments, use: [GENERATE_VIDEO: prompt for short video clip]
        4. The generation tags will be replaced with actual media
        5. Maintain narrative flow - the media should enhance the story
        
        Start your response with a brief "director's note" in italics about your creative approach.
        """
        
        # Store in context
        self.context.append({"role": "user", "content": request.prompt})
        
        # Create the full prompt with history
        full_prompt = system_prompt + "\n\nUser Request: " + request.prompt
        if self.context:
            full_prompt += "\n\nContext: " + json.dumps(self.context[-5:])  # Last 5 messages
        
        # Stream from Gemini
        response = await gemini_model.generate_content_async(
            full_prompt,
            stream=True,
            generation_config={
                "temperature": 0.8,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 8192,
            }
        )
        
        async for chunk in response:
            if chunk.text:
                # Parse chunk for generation tags
                text = chunk.text
                
                # Check for image generation triggers
                if "[GENERATE_IMAGE:" in text:
                    # Split and process image generations
                    parts = text.split("[GENERATE_IMAGE:")
                    for i, part in enumerate(parts):
                        if i == 0:
                            yield part
                        else:
                            prompt_end = part.find("]")
                            if prompt_end != -1:
                                image_prompt = part[:prompt_end]
                                # Queue image generation
                                asyncio.create_task(self.generate_and_stream_image(image_prompt))
                                # Yield placeholder that frontend will replace
                                yield f"[IMAGE_GENERATING:{hashlib.md5(image_prompt.encode()).hexdigest()[:8]}]"
                                yield part[prompt_end+1:]
                            else:
                                yield part
                
                # Check for video generation triggers
                elif "[GENERATE_VIDEO:" in text and request.include_video:
                    parts = text.split("[GENERATE_VIDEO:")
                    for i, part in enumerate(parts):
                        if i == 0:
                            yield part
                        else:
                            prompt_end = part.find("]")
                            if prompt_end != -1:
                                video_prompt = part[:prompt_end]
                                asyncio.create_task(self.generate_and_stream_video(video_prompt))
                                yield f"[VIDEO_GENERATING:{hashlib.md5(video_prompt.encode()).hexdigest()[:8]}]"
                                yield part[prompt_end+1:]
                            else:
                                yield part
                else:
                    yield text
        
        # Store assistant response
        self.context.append({"role": "assistant", "content": "Story generation complete"})
    
    async def generate_and_stream_image(self, prompt: str):
        """Generate image using Imagen and stream to frontend"""
        try:
            logger.info(f"Generating image for prompt: {prompt}")
            
            # Initialize Imagen
            imagen = ImageGenerationModel.from_pretrained("imagegeneration@002")
            
            # Generate image
            images = imagen.generate_images(
                prompt=prompt,
                number_of_images=1,
                aspect_ratio="16:9",
                safety_filter_level="block_some",
                person_generation="allow_adult"
            )
            
            if images and images[0]:
                # Save to GCS
                image = images[0]
                filename = f"sessions/{self.session_id}/images/{uuid.uuid4()}.png"
                blob = bucket.blob(filename)
                
                # Convert PIL Image to bytes and upload
                import io
                img_bytes = io.BytesIO()
                image._pil_image.save(img_bytes, format='PNG')
                img_bytes.seek(0)
                blob.upload_from_file(img_bytes, content_type='image/png')
                
                # Make public
                blob.make_public()
                image_url = blob.public_url
                
                # Save metadata to Firestore
                asset_ref = db.collection("sessions").document(self.session_id).collection("assets").document()
                await asset_ref.set({
                    "type": "image",
                    "prompt": prompt,
                    "url": image_url,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "status": "completed"
                })
                
                # Send to frontend via WebSocket or Redis pub/sub
                await self.publish_asset("image", image_url, prompt)
                
        except Exception as e:
            logger.error(f"Image generation failed: {str(e)}")
            logger.error(traceback.format_exc())
    
    async def generate_and_stream_video(self, prompt: str):
        """Generate video using Veo/Lumiere and stream to frontend"""
        try:
            logger.info(f"Generating video for prompt: {prompt}")
            
            # For hackathon MVP, we'll use a placeholder or simpler model
            # In production, use Veo API
            from vertexai.preview.vision_models import VideoGenerationModel
            
            video_model = VideoGenerationModel.from_pretrained("video-generation-model")
            
            # Generate video (simplified for demo)
            videos = video_model.generate_videos(
                prompt=prompt,
                duration_seconds=4,
                aspect_ratio="16:9"
            )
            
            if videos and videos[0]:
                filename = f"sessions/{self.session_id}/videos/{uuid.uuid4()}.mp4"
                blob = bucket.blob(filename)
                
                # Upload video bytes
                blob.upload_from_string(videos[0].video_bytes, content_type='video/mp4')
                blob.make_public()
                video_url = blob.public_url
                
                # Save metadata
                asset_ref = db.collection("sessions").document(self.session_id).collection("assets").document()
                await asset_ref.set({
                    "type": "video",
                    "prompt": prompt,
                    "url": video_url,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "status": "completed"
                })
                
                await self.publish_asset("video", video_url, prompt)
                
        except Exception as e:
            logger.error(f"Video generation failed: {str(e)}")
    
    async def publish_asset(self, asset_type: str, url: str, prompt: str):
        """Publish generated asset to frontend via Redis pub/sub"""
        message = {
            "type": f"{asset_type}_ready",
            "url": url,
            "prompt": prompt,
            "timestamp": datetime.now().isoformat(),
            "placeholder_id": hashlib.md5(prompt.encode()).hexdigest()[:8]
        }
        await redis_client.publish(f"session:{self.session_id}", json.dumps(message))

# API Endpoints

@app.post("/api/story/start")
async def start_story(request: DirectorRequest):
    """Start a new storytelling session"""
    try:
        # Generate session ID if not provided
        session_id = request.session_id or str(uuid.uuid4())
        
        # Initialize session in Firestore
        session_ref = db.collection("sessions").document(session_id)
        await session_ref.set({
            "prompt": request.prompt,
            "style": request.style,
            "tone": request.tone,
            "include_video": request.include_video,
            "pacing": request.pacing,
            "created_at": firestore.SERVER_TIMESTAMP,
            "status": "active"
        })
        
        # Create agent instance
        agent = StoryWeaverAgent(session_id)
        
        # Store in Redis for quick access
        await redis_client.setex(
            f"agent:{session_id}",
            3600,  # 1 hour
            json.dumps({"session_id": session_id, "status": "active"})
        )
        
        return JSONResponse({
            "session_id": session_id,
            "message": "Story session started",
            "status": "success"
        })
        
    except Exception as e:
        logger.error(f"Failed to start story: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/story/{session_id}")
async def websocket_story(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time story streaming"""
    await websocket.accept()
    
    try:
        # Subscribe to Redis channel for this session
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"session:{session_id}")
        
        # Get session data
        session_data = await db.collection("sessions").document(session_id).get()
        if not session_data.exists:
            await websocket.send_json({"error": "Session not found"})
            await websocket.close()
            return
        
        session_dict = session_data.to_dict()
        
        # Create agent
        agent = StoryWeaverAgent(session_id)
        
        # Create request object
        request = DirectorRequest(
            prompt=session_dict.get("prompt", ""),
            session_id=session_id,
            style=session_dict.get("style", "cinematic"),
            tone=session_dict.get("tone", "neutral"),
            include_video=session_dict.get("include_video", False),
            pacing=session_dict.get("pacing", "balanced")
        )
        
        # Start processing in background
        async def stream_generator():
            async for chunk in agent.process_prompt(request):
                await websocket.send_json({
                    "type": "text_chunk",
                    "content": chunk,
                    "timestamp": datetime.now().isoformat()
                })
        
        # Handle incoming messages and asset notifications
        async def listen_for_assets():
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = json.loads(message["data"])
                    await websocket.send_json({
                        "type": data["type"],
                        "url": data.get("url"),
                        "prompt": data.get("prompt"),
                        "placeholder_id": data.get("placeholder_id"),
                        "timestamp": datetime.now().isoformat()
                    })
        
        # Run both tasks concurrently
        await asyncio.gather(
            stream_generator(),
            listen_for_assets()
        )
        
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.send_json({"error": str(e)})
    finally:
        await pubsub.unsubscribe(f"session:{session_id}")

@app.get("/api/story/{session_id}/assets")
async def get_session_assets(session_id: str):
    """Get all generated assets for a session"""
    try:
        assets_ref = db.collection("sessions").document(session_id).collection("assets")
        assets = await assets_ref.order_by("timestamp").get()
        
        return JSONResponse({
            "session_id": session_id,
            "assets": [
                {
                    "id": asset.id,
                    "type": asset.get("type"),
                    "url": asset.get("url"),
                    "prompt": asset.get("prompt"),
                    "timestamp": asset.get("timestamp").isoformat() if asset.get("timestamp") else None
                }
                for asset in assets
            ]
        })
        
    except Exception as e:
        logger.error(f"Failed to fetch assets: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "StoryWeaver Backend",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)