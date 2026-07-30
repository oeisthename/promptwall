import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from promptwall.cli.config import get_api_key, get_base_url
from promptwall.client import PromptWallClient
from promptwall.enforcer import Enforcer

logger = logging.getLogger(__name__)

def get_enforcer() -> Enforcer:
    api_key = get_api_key()
    base_url = get_base_url()
    if not api_key or not base_url:
        raise ValueError("PromptWall CLI is not configured. Run 'promptwall init'.")
    client = PromptWallClient(api_key=api_key, base_url=base_url)
    return Enforcer.from_api(client, environment="production")

def extract_prompt_from_messages(messages: list[dict[str, Any]]) -> str:
    """Extract all content from the messages payload as a single string."""
    return "\n".join(msg.get("content", "") for msg in messages if isinstance(msg.get("content"), str))

def create_proxy_app(default_upstream: str = "https://api.openai.com") -> FastAPI:
    app = FastAPI(title="PromptWall Proxy")
    
    http_client = httpx.AsyncClient()

    @app.on_event("shutdown")
    async def shutdown_event() -> None:
        await http_client.aclose()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def api_proxy(path: str, request: Request) -> Response:
        try:
            enforcer = get_enforcer()
        except Exception as e:
            logger.error(f"Failed to load enforcer: {e}")
            return JSONResponse(
                status_code=500,
                content={"error": {"message": f"PromptWall config error: {e}", "type": "promptwall_error"}}
            )

        body_bytes = await request.body()
        is_stream = False
        
        if request.method == "POST" and ("chat/completions" in path or "completions" in path):
            try:
                payload = json.loads(body_bytes)
                is_stream = payload.get("stream", False)
                messages = payload.get("messages", [])
                
                if "prompt" in payload and not messages:
                    prompt_str = payload["prompt"]
                else:
                    prompt_str = extract_prompt_from_messages(messages)
                
                if prompt_str:
                    decision = enforcer.enforce(tool_call={"name": "proxy"}, content=prompt_str)
                    
                    if decision.action in ("block", "require_approval"):
                        return JSONResponse(
                            status_code=403,
                            content={
                                "error": {
                                    "message": f"Blocked by PromptWall: {decision.reason}",
                                    "type": "security_policy_violation",
                                    "code": "promptwall_blocked"
                                }
                            }
                        )
                    elif decision.action in ("sanitize", "redact") and decision.sanitized_content:
                        if "messages" in payload and messages:
                            for msg in reversed(payload["messages"]):
                                if msg.get("role") == "user":
                                    msg["content"] = decision.sanitized_content
                                    break
                        elif "prompt" in payload:
                            payload["prompt"] = decision.sanitized_content
                        
                        body_bytes = json.dumps(payload).encode("utf-8")
                        
            except json.JSONDecodeError:
                pass

        headers = dict(request.headers)
        headers.pop("host", None)
        
        upstream_url = headers.pop("x-promptwall-upstream", default_upstream)
        url = f"{upstream_url}/{path}"
        
        if is_stream:
            async def stream_generator() -> AsyncGenerator[bytes, None]:
                async with http_client.stream(
                    method=request.method,
                    url=url,
                    headers=headers,
                    content=body_bytes,
                ) as upstream_response:
                    async for chunk in upstream_response.aiter_bytes():
                        yield chunk
            
            return StreamingResponse(
                stream_generator(),
                media_type="text/event-stream"
            )
        else:
            upstream_response = await http_client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body_bytes,
            )
            return Response(
                content=upstream_response.content,
                status_code=upstream_response.status_code,
                headers={k: v for k, v in upstream_response.headers.items() if k.lower() not in ("content-encoding", "content-length", "transfer-encoding")}
            )

    return app
