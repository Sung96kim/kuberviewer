import asyncio
import logging
from collections.abc import AsyncGenerator
from concurrent.futures import ThreadPoolExecutor

from app.kube.manager import KubeManager

logger = logging.getLogger(__name__)

_stream_executor = ThreadPoolExecutor(max_workers=16, thread_name_prefix="logstream")


async def stream_pod_logs(
    namespace: str,
    pod_name: str,
    container: str | None = None,
    tail_lines: int | None = None,
    since_seconds: int | None = None,
    timestamps: bool = False,
    follow: bool = True,
    previous: bool = False,
) -> AsyncGenerator[str, None]:
    api_client = KubeManager.get_instance().get_api_client()
    path = f"/api/v1/namespaces/{namespace}/pods/{pod_name}/log"

    query_params: list[tuple[str, str]] = []
    if container:
        query_params.append(("container", container))
    if tail_lines is not None:
        query_params.append(("tailLines", str(tail_lines)))
    if since_seconds is not None:
        query_params.append(("sinceSeconds", str(since_seconds)))
    if timestamps:
        query_params.append(("timestamps", "true"))
    if follow:
        query_params.append(("follow", "true"))
    if previous:
        query_params.append(("previous", "true"))

    def _open_stream():
        resp = api_client.call_api(
            path,
            "GET",
            query_params=query_params,
            response_type="object",
            auth_settings=["BearerToken"],
            _preload_content=False,
        )
        return resp[0]

    response = await asyncio.to_thread(_open_stream)

    loop = asyncio.get_event_loop()
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    def _read_stream() -> None:
        try:
            for chunk in response.stream(4096, decode_content=True):
                if chunk:
                    loop.call_soon_threadsafe(queue.put_nowait, chunk.decode("utf-8"))
            loop.call_soon_threadsafe(queue.put_nowait, None)
        except Exception:
            logger.exception("Log stream error")
            loop.call_soon_threadsafe(queue.put_nowait, None)
        finally:
            response.close()

    loop.run_in_executor(_stream_executor, _read_stream)

    buffer = ""
    try:
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            buffer += chunk
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                if line:
                    yield f"data: {line}\n\n"
        if buffer.strip():
            yield f"data: {buffer.strip()}\n\n"
    finally:
        response.close()
