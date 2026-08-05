"""AI provider catalogue — models offered per provider for the model selector."""

PROVIDER_MODELS: dict[str, list[dict]] = {
    "anthropic": [
        {"id": "claude-opus-4-6", "name": "Claude Opus 4.6", "description": "Most powerful, best for complex tasks", "context": "200K"},
        {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "description": "Fast and intelligent, best balance", "context": "200K"},
        {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "description": "Fastest, best for simple tasks", "context": "200K"},
    ],
    "openai": [
        {"id": "gpt-4o", "name": "GPT-4o", "description": "Most capable OpenAI model", "context": "128K"},
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast and affordable", "context": "128K"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "description": "Previous gen, still powerful", "context": "128K"},
        {"id": "o1-mini", "name": "o1 Mini", "description": "Reasoning model", "context": "128K"},
    ],
    "openrouter": [
        {"id": "meta-llama/llama-3.1-70b-instruct", "name": "Llama 3.1 70B", "description": "Meta's open source model", "context": "128K"},
        {"id": "google/gemini-pro-1.5", "name": "Gemini Pro 1.5", "description": "Google's latest model", "context": "1M"},
        {"id": "mistralai/mistral-large", "name": "Mistral Large", "description": "European AI powerhouse", "context": "128K"},
        {"id": "anthropic/claude-opus-4-6", "name": "Claude Opus (via OpenRouter)", "description": "Claude via OpenRouter", "context": "200K"},
        {"id": "openai/gpt-4o", "name": "GPT-4o (via OpenRouter)", "description": "GPT-4o via OpenRouter", "context": "128K"},
        {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1", "description": "Powerful reasoning model", "context": "64K"},
        {"id": "qwen/qwen-2.5-72b-instruct", "name": "Qwen 2.5 72B", "description": "Alibaba's model", "context": "128K"},
    ],
    "nvidia": [
        {"id": "meta/llama-3.1-70b-instruct", "name": "Llama 3.1 70B (NIM)", "description": "Fast inference via Nvidia", "context": "128K"},
        {"id": "nvidia/llama-3.3-nemotron-super-49b-v1", "name": "Nemotron Super 49B", "description": "Nvidia's flagship open model", "context": "128K"},
        {"id": "nvidia/nemotron-3-nano-30b-a3b", "name": "Nemotron Nano 30B", "description": "Fast, efficient Nvidia model", "context": "128K"},
    ],
}

PROVIDER_LABELS: dict[str, str] = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "openrouter": "OpenRouter",
    "nvidia": "Nvidia NIM",
}

PLATFORM_DEFAULT_MODEL = "claude-opus-4-6"
