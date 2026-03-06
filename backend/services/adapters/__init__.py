from .gemini_adapter import GeminiAdapter
from .openai_adapter import OpenAIAdapter
from .claude_adapter import ClaudeAdapter
from .deepseek_adapter import DeepSeekAdapter

def get_adapter(api_type):
    t = api_type.lower()
    if t == 'openai': return OpenAIAdapter()
    if t == 'claude': return ClaudeAdapter()
    if t == 'deepseek': return DeepSeekAdapter()
    return GeminiAdapter()