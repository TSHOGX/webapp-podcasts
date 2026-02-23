"""AI 服务：使用 LiteLLM 调用大模型 API"""
import os
from typing import AsyncGenerator, Dict, Any, Optional
from cryptography.fernet import Fernet
import litellm
from litellm import acompletion

# 加密工具
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
fernet = Fernet(ENCRYPTION_KEY.encode() if ENCRYPTION_KEY else Fernet.generate_key())


def encrypt_api_key(api_key: str) -> str:
    """加密 API Key"""
    if ENCRYPTION_KEY and fernet:
        return fernet.encrypt(api_key.encode()).decode()
    return api_key


def decrypt_api_key(encrypted_key: str) -> str:
    """解密 API Key"""
    if ENCRYPTION_KEY and fernet:
        try:
            return fernet.decrypt(encrypted_key.encode()).decode()
        except Exception:
            # If decryption fails, return as-is (might be unencrypted)
            return encrypted_key
    return encrypted_key


class AIService:
    def __init__(
        self,
        provider: str,
        api_key: str,
        model: str,
        base_url: Optional[str] = None,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7
    ):
        self.provider = provider
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.system_prompt = system_prompt
        self.temperature = temperature

        # 构建 LiteLLM 模型名
        self.litellm_model = self._build_model_name()

    def _build_model_name(self) -> str:
        """根据 provider 构建 LiteLLM 模型名"""
        if self.provider == "kimi":
            # Kimi uses OpenAI-compatible API
            return f"openai/{self.model}"
        elif self.provider == "openai":
            return f"openai/{self.model}"
        elif self.provider == "anthropic":
            return f"anthropic/{self.model}"
        else:
            # Custom provider - use model as-is
            return self.model

    def _get_api_base(self) -> Optional[str]:
        """获取 API base URL"""
        if self.base_url:
            return self.base_url
        if self.provider == "kimi":
            return "https://api.moonshot.cn/v1"
        return None

    def _get_temperature(self) -> float:
        """获取 temperature，Kimi 只支持 temperature=1"""
        if self.provider == "kimi":
            return 1.0
        return self.temperature

    async def generate_summary(
        self,
        transcription: str,
        user_prompt_template: str,
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """生成转录文本的总结"""
        # 替换模板变量
        prompt = user_prompt_template.replace("{{transcription}}", transcription)

        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})
        messages.append({"role": "user", "content": prompt})

        base_url = self._get_api_base()

        response = await acompletion(
            model=self.litellm_model,
            messages=messages,
            api_key=self.api_key,
            base_url=base_url,
            stream=stream,
            temperature=self._get_temperature(),
            max_tokens=200000
        )

        if stream:
            async for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        else:
            yield response.choices[0].message.content

    async def chat(
        self,
        messages: list[Dict[str, str]],
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """多轮对话"""
        base_url = self._get_api_base()

        response = await acompletion(
            model=self.litellm_model,
            messages=messages,
            api_key=self.api_key,
            base_url=base_url,
            stream=stream,
            temperature=self._get_temperature(),
            max_tokens=200000
        )

        if stream:
            async for chunk in response:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        else:
            yield response.choices[0].message.content

    async def generate_summary_sync(
        self,
        transcription: str,
        user_prompt_template: str
    ) -> str:
        """生成总结（非流式，返回完整文本）"""
        # 替换模板变量
        prompt = user_prompt_template.replace("{{transcription}}", transcription)

        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})
        messages.append({"role": "user", "content": prompt})

        base_url = self._get_api_base()

        response = await acompletion(
            model=self.litellm_model,
            messages=messages,
            api_key=self.api_key,
            base_url=base_url,
            stream=False,
            temperature=self._get_temperature(),
            max_tokens=200000
        )

        return response.choices[0].message.content
