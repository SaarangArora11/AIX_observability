# Refract-sdk

Python SDK for [Refract](https://useRefract.com) — OpenTelemetry-native LLM observability.

## Installation

```bash
pip install Refract-sdk
```

Or install directly from the monorepo for development:

```bash
pip install -e packages/sdk-python/
```

## Quick start

```python
import os
from Refract import init_refract

Refract = init_refract({
    "api_key": os.environ["REFRACT_API_KEY"],
    "service_name": "my-app",
    "endpoint": "https://collector.Refract.app/v1/traces",
})

# Trace an OpenAI call
import openai
client = openai.OpenAI()

response = Refract.trace_llm(
    lambda: client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello!"}],
    ),
    name="greeting",
    system="openai",
    prompt="Hello!",
)
print(response.choices[0].message.content)
```

### Async usage

```python
import asyncio
import openai
from Refract import init_refract

Refract = init_refract({"service_name": "my-app"})
client = openai.AsyncOpenAI()

async def main():
    response = await Refract.trace_llm(
        lambda: client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": "Hello!"}],
        ),
        name="greeting",
        system="openai",
    )
    print(response.choices[0].message.content)

asyncio.run(main())
```

### Custom spans

```python
result = Refract.trace(
    "rag_pipeline",
    lambda span: run_rag(span),
    metadata={"query": "What is observability?"},
    tags=["rag", "production"],
)
```

## Environment variables

| Variable                   | Default                           | Description                        |
| -------------------------- | --------------------------------- | ---------------------------------- |
| `REFRACT_API_KEY`           | —                                 | API key (omit for self-hosted)     |
| `REFRACT_ENDPOINT`          | `http://localhost:9411/v1/traces` | OTLP collector URL                 |
| `Refract_SERVICE_NAME`      | —                                 | Service name attached to all spans |
| `REFRACT_ENVIRONMENT`       | `live`                            | `live` or `test`                   |
| `Refract_CUSTOMER_ID`       | —                                 | Customer identifier                |
| `REFRACT_ENABLED`           | `true`                            | Set to `false` to disable          |
| `REFRACT_BATCH_SIZE`        | `10`                              | Max spans per export batch         |
| `REFRACT_BATCH_INTERVAL_MS` | `5000`                            | Batch flush interval (ms)          |
| `REFRACT_MAX_RETRIES`       | `3`                               | Export retry count                 |
| `REFRACT_TIMEOUT_MS`        | `30000`                           | Export timeout (ms)                |
