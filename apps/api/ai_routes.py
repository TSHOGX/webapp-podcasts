"""AI 相关 API 路由"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json

from ai_service import AIService, decrypt_api_key, encrypt_api_key
from supabase import create_client, Client

router = APIRouter(prefix="/ai", tags=["AI"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_supabase() -> Client | None:
    """Get Supabase client if configured"""
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return None


class ChatRequest(BaseModel):
    transcription_id: str
    message: str
    conversation_history: List[Dict[str, str]] = []


class SettingsRequest(BaseModel):
    llm_provider: str
    llm_api_key: str
    llm_model: str
    llm_base_url: Optional[str] = None
    system_prompt: Optional[str] = None
    user_prompt_template: Optional[str] = None
    temperature: float = 0.7
    enable_auto_summary: Optional[bool] = None


class RegenerateSummaryRequest(BaseModel):
    transcription_id: str
    transcription_text: str


@router.post("/chat")
async def chat(request: ChatRequest, http_request: Request):
    """对话接口（流式返回 SSE）"""
    try:
        # Get user ID from header (set by Next.js middleware)
        user_id = http_request.headers.get("x-user-id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        supabase = get_supabase()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        # 1. 获取用户设置
        result = supabase.table("pc_user_settings") \
            .select("*") \
            .eq("user_id", user_id) \
            .maybe_single() \
            .execute()

        if not result.data:
            raise HTTPException(status_code=400, detail="AI settings not configured. Please configure settings first.")

        settings = result.data

        # 2. 检查必需字段
        required_fields = ["llm_provider", "llm_api_key", "llm_model"]
        for field in required_fields:
            if not settings.get(field):
                raise HTTPException(status_code=400, detail=f"Missing required setting: {field}")

        # 3. 解密 API Key
        api_key = decrypt_api_key(settings["llm_api_key"])

        # 4. 构建 AI 服务
        ai_service = AIService(
            provider=settings["llm_provider"],
            api_key=api_key,
            model=settings["llm_model"],
            base_url=settings.get("llm_base_url"),
            system_prompt=settings.get("system_prompt"),
            temperature=settings.get("temperature", 0.7)
        )

        # 5. 构建消息列表
        messages = []
        if settings.get("system_prompt"):
            messages.append({"role": "system", "content": settings["system_prompt"]})

        # Add conversation history
        for msg in request.conversation_history:
            messages.append(msg)

        # Add new user message
        messages.append({"role": "user", "content": request.message})

        # 6. 流式返回 SSE
        async def generate():
            full_content = ""
            async for chunk in ai_service.chat(messages, stream=True):
                full_content += chunk
                # SSE format
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"

            # Store assistant response in database
            try:
                supabase.table("pc_ai_chats").insert({
                    "transcription_id": request.transcription_id,
                    "user_id": user_id,
                    "role": "user",
                    "content": request.message,
                    "model": settings["llm_model"],
                    "metadata": {
                        "temperature": settings.get("temperature"),
                        "conversation": True
                    }
                }).execute()

                supabase.table("pc_ai_chats").insert({
                    "transcription_id": request.transcription_id,
                    "user_id": user_id,
                    "role": "assistant",
                    "content": full_content,
                    "model": settings["llm_model"],
                    "metadata": {
                        "temperature": settings.get("temperature"),
                        "conversation": True
                    }
                }).execute()
            except Exception as e:
                print(f"Failed to store chat messages: {e}")

            # Send done event
            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings")
async def get_settings(http_request: Request):
    """获取用户 AI 设置（API Key 不返回或脱敏）"""
    try:
        user_id = http_request.headers.get("x-user-id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        supabase = get_supabase()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        try:
            result = supabase.table("pc_user_settings") \
                .select("*") \
                .eq("user_id", user_id) \
                .maybe_single() \
                .execute()
        except Exception as e:
            print(f"Error fetching settings: {e}")
            result = None

        if not result or not hasattr(result, 'data') or not result.data:
            # Return default settings
            return {
                "llm_provider": "kimi",
                "llm_api_key": "",
                "llm_base_url": None,
                "llm_model": "kimi-latest",
                "system_prompt": "你是一个专业的播客内容分析师，擅长从转录文本中提取关键信息并生成结构化的内容总结。",
                "user_prompt_template": "请根据以下播客转录文本，生成一份结构化的内容总结：\n\n{{transcription}}\n\n请包含以下部分：\n1. 核心观点概述\n2. 关键话题与讨论要点\n3. 重要引用或案例\n4. 结论与启发",
                "temperature": 0.7,
                "enable_auto_summary": True,
                "has_api_key": False,
            }

        settings = result.data if result and hasattr(result, 'data') else None
        if not settings:
            # Return default settings if data is None
            return {
                "llm_provider": "kimi",
                "llm_api_key": "",
                "llm_base_url": None,
                "llm_model": "kimi-latest",
                "system_prompt": "你是一个专业的播客内容分析师，擅长从转录文本中提取关键信息并生成结构化的内容总结。",
                "user_prompt_template": "请根据以下播客转录文本，生成一份结构化的内容总结：\n\n{{transcription}}\n\n请包含以下部分：\n1. 核心观点概述\n2. 关键话题与讨论要点\n3. 重要引用或案例\n4. 结论与启发",
                "temperature": 0.7,
                "enable_auto_summary": True,
                "has_api_key": False,
            }
        # Hide API key but add flag indicating if it's configured
        has_api_key = bool(settings.get("llm_api_key"))
        settings["llm_api_key"] = ""
        settings["has_api_key"] = has_api_key

        return settings

    except HTTPException:
        raise
    except Exception as e:
        print(f"Get settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/settings")
async def update_settings(request: SettingsRequest, http_request: Request):
    """更新用户 AI 设置（API Key 加密存储）"""
    try:
        user_id = http_request.headers.get("x-user-id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        supabase = get_supabase()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        # Encrypt API key if provided
        encrypted_key = encrypt_api_key(request.llm_api_key) if request.llm_api_key else ""

        # Check if settings exist
        try:
            existing = supabase.table("pc_user_settings") \
                .select("id") \
                .eq("user_id", user_id) \
                .maybe_single() \
                .execute()
        except Exception as e:
            print(f"Error checking existing settings: {e}")
            existing = None

        settings_data = {
            "llm_provider": request.llm_provider,
            "llm_model": request.llm_model,
            "llm_base_url": request.llm_base_url,
            "system_prompt": request.system_prompt,
            "user_prompt_template": request.user_prompt_template,
            "temperature": request.temperature,
            "enable_auto_summary": request.enable_auto_summary if request.enable_auto_summary is not None else True,
        }

        # Only update API key if a new one is provided
        if request.llm_api_key:
            settings_data["llm_api_key"] = encrypted_key

        if existing and hasattr(existing, 'data') and existing.data:
            # Update existing settings
            result = supabase.table("pc_user_settings") \
                .update(settings_data) \
                .eq("user_id", user_id) \
                .execute()
        else:
            # Insert new settings
            settings_data["user_id"] = user_id
            settings_data["llm_api_key"] = encrypted_key
            result = supabase.table("pc_user_settings") \
                .insert(settings_data) \
                .execute()

        return {"success": True, "message": "Settings updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Update settings error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chats/{transcription_id}")
async def get_chats(transcription_id: str, http_request: Request):
    """获取某个转录的所有对话历史"""
    try:
        user_id = http_request.headers.get("x-user-id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        supabase = get_supabase()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        result = supabase.table("pc_ai_chats") \
            .select("*") \
            .eq("transcription_id", transcription_id) \
            .eq("user_id", user_id) \
            .order("created_at", desc=False) \
            .execute()

        return {"chats": result.data or []}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Get chats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/regenerate-summary")
async def regenerate_summary(request: RegenerateSummaryRequest, http_request: Request):
    """重新生成总结"""
    try:
        user_id = http_request.headers.get("x-user-id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Unauthorized")

        supabase = get_supabase()
        if not supabase:
            raise HTTPException(status_code=500, detail="Supabase not configured")

        # Get user settings
        result = supabase.table("pc_user_settings") \
            .select("*") \
            .eq("user_id", user_id) \
            .maybe_single() \
            .execute()

        if not result.data:
            raise HTTPException(status_code=400, detail="AI settings not configured")

        settings = result.data

        # Check required fields
        required_fields = ["llm_provider", "llm_api_key", "llm_model"]
        for field in required_fields:
            if not settings.get(field):
                raise HTTPException(status_code=400, detail=f"Missing required setting: {field}")

        # Decrypt API Key
        api_key = decrypt_api_key(settings["llm_api_key"])

        # Build AI service
        ai_service = AIService(
            provider=settings["llm_provider"],
            api_key=api_key,
            model=settings["llm_model"],
            base_url=settings.get("llm_base_url"),
            system_prompt=settings.get("system_prompt"),
            temperature=settings.get("temperature", 0.7)
        )

        user_prompt_template = settings.get("user_prompt_template", "")

        # Delete existing auto-generated summary
        try:
            supabase.table("pc_ai_chats") \
                .delete() \
                .eq("transcription_id", request.transcription_id) \
                .eq("user_id", user_id) \
                .eq("metadata->>auto_generated", "true") \
                .execute()
        except Exception as e:
            print(f"Failed to delete old summary: {e}")

        # Prepare user prompt
        user_prompt = user_prompt_template.replace("{{transcription}}", request.transcription_text)

        # Store user message before streaming
        try:
            supabase.table("pc_ai_chats").insert({
                "transcription_id": request.transcription_id,
                "user_id": user_id,
                "role": "user",
                "content": user_prompt,
                "model": settings["llm_model"],
                "metadata": {
                    "type": "summary_prompt",
                    "auto_generated": True
                }
            }).execute()
        except Exception as e:
            print(f"Failed to store user prompt: {e}")

        # Stream the new summary
        async def generate():
            full_content = ""
            async for chunk in ai_service.generate_summary(
                transcription=request.transcription_text,
                user_prompt_template=user_prompt_template,
                stream=True
            ):
                full_content += chunk
                yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"

            # Store the new summary
            try:
                supabase.table("pc_ai_chats").insert({
                    "transcription_id": request.transcription_id,
                    "user_id": user_id,
                    "role": "assistant",
                    "content": full_content,
                    "model": settings["llm_model"],
                    "metadata": {
                        "temperature": settings.get("temperature"),
                        "prompt_template": user_prompt_template,
                        "system_prompt": settings.get("system_prompt"),
                        "auto_generated": True,
                        "regenerated": True
                    }
                }).execute()
            except Exception as e:
                print(f"Failed to store regenerated summary: {e}")

            yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Regenerate summary error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
