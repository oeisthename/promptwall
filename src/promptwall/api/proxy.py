import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

import httpx
from fastapi import BackgroundTasks, FastAPI, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from promptwall.audit import AuditLogger
from promptwall.cli.config import (
    get_api_key,
    get_base_url,
    get_fallback_api_key,
    get_fallback_enabled,
    get_fallback_model,
    get_fallback_upstream,
)
from promptwall.client import PromptWallClient
from promptwall.enforcer import Enforcer

logger = logging.getLogger(__name__)
audit_logger = AuditLogger()


def get_enforcer() -> Enforcer:
    api_key = get_api_key()
    base_url = get_base_url()
    if not api_key or not base_url:
        raise ValueError("PromptWall CLI is not configured. Run 'promptwall init'.")
    client = PromptWallClient(api_key=api_key, base_url=base_url)
    return Enforcer.from_api(client, environment="production")


def extract_prompt_from_messages(messages: list[dict[str, Any]]) -> str:
    """Extract all content from the messages payload as a single string."""
    return "\n".join(
        msg.get("content", "") for msg in messages if isinstance(msg.get("content"), str)
    )  # noqa: E501


def create_proxy_app(default_upstream: str = "https://api.openai.com") -> FastAPI:
    app = FastAPI(title="PromptWall Proxy")

    http_client = httpx.AsyncClient()

    @app.on_event("shutdown")
    async def shutdown_event() -> None:
        await http_client.aclose()

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def api_proxy(path: str, request: Request, background_tasks: BackgroundTasks) -> Response:
        try:
            enforcer = get_enforcer()
        except Exception as e:
            logger.error(f"Failed to load enforcer: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "message": f"PromptWall config error: {e}",
                        "type": "promptwall_error",
                    }
                },  # noqa: E501
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
                    start_time = time.perf_counter()
                    decision = enforcer.enforce(tool_call={"name": "proxy"}, content=prompt_str)
                    latency = round((time.perf_counter() - start_time) * 1000, 2)

                    background_tasks.add_task(
                        audit_logger.log_event,
                        decision=decision.action,
                        original_prompt=prompt_str,
                        latency=latency,
                        matched_rule=decision.rule_name if hasattr(decision, "rule_name") else None,
                        sanitized_prompt=decision.sanitized_content,
                        score=0.0,  # Optional score if available
                    )

                    if decision.action in ("block", "require_approval"):
                        return JSONResponse(
                            status_code=403,
                            content={
                                "error": {
                                    "message": f"Blocked by PromptWall: {decision.reason}",
                                    "type": "security_policy_violation",
                                    "code": "promptwall_blocked",
                                }
                            },
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

        async def _dispatch(
            target_url: str, request_headers: dict[str, str], request_body: bytes
        ) -> Response:
            req = http_client.build_request(
                method=request.method,
                url=target_url,
                headers=request_headers,
                content=request_body,
            )
            if is_stream:
                upstream_response = await http_client.send(req, stream=True)
                upstream_response.raise_for_status()

                async def stream_generator() -> AsyncGenerator[bytes, None]:
                    try:
                        async for chunk in upstream_response.aiter_bytes():
                            yield chunk
                    finally:
                        await upstream_response.aclose()

                return StreamingResponse(stream_generator(), media_type="text/event-stream")
            else:
                upstream_response = await http_client.send(req, stream=False)
                upstream_response.raise_for_status()
                return Response(
                    content=upstream_response.content,
                    status_code=upstream_response.status_code,
                    headers={
                        k: v
                        for k, v in upstream_response.headers.items()
                        if k.lower()
                        not in ("content-encoding", "content-length", "transfer-encoding")
                    },
                )

        try:
            return await _dispatch(url, headers, body_bytes)
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            fallback_enabled = get_fallback_enabled()
            fallback_upstream = get_fallback_upstream()

            if not fallback_enabled or not fallback_upstream:
                logger.warning(f"Upstream request failed: {e}. No fallback configured.")
                return JSONResponse(status_code=502, content={"error": "Bad Gateway"})

            logger.warning(f"Upstream request failed: {e}. Attempting fallback...")

            fallback_url = f"{fallback_upstream}/{path}"
            fallback_headers = headers.copy()

            fallback_api_key = get_fallback_api_key()
            if fallback_api_key:
                fallback_headers["authorization"] = f"Bearer {fallback_api_key}"

            fallback_model = get_fallback_model()
            fallback_body_bytes = body_bytes
            if fallback_model and request.method == "POST":
                try:
                    payload = json.loads(body_bytes)
                    payload["model"] = fallback_model
                    fallback_body_bytes = json.dumps(payload).encode("utf-8")
                except json.JSONDecodeError:
                    pass

            try:
                return await _dispatch(fallback_url, fallback_headers, fallback_body_bytes)
            except Exception as fallback_error:
                logger.error(f"Fallback request also failed: {fallback_error}")
                return JSONResponse(
                    status_code=502, content={"error": "Bad Gateway after fallback"}
                )

    return app
