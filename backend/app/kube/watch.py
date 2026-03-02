import asyncio
import logging
from collections.abc import AsyncGenerator
from concurrent.futures import ThreadPoolExecutor

from app.kube.manager import KubeManager
from app.kube.resources import build_resource_url

logger = logging.getLogger(__name__)

_watch_executor = ThreadPoolExecutor(max_workers=32, thread_name_prefix="watch")


async def watch_resources(
    group: str,
    version: str,
    name: str,
    namespaced: bool,
    namespace: str | None = None,
    resource_version: str | None = None,
) -> AsyncGenerator[str, None]:
    api_client = KubeManager.get_instance().get_api_client()
    path = build_resource_url(group, version, name, namespaced, namespace)

    query_params: list[tuple[str, str]] = [("watch", "true")]
    if resource_version:
        query_params.append(("resourceVersion", resource_version))

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
            for chunk in response.stream(512, decode_content=True):
                if chunk:
                    loop.call_soon_threadsafe(queue.put_nowait, chunk.decode("utf-8"))
            loop.call_soon_threadsafe(queue.put_nowait, None)
        except AttributeError:
            loop.call_soon_threadsafe(queue.put_nowait, None)
        except Exception:
            logger.exception("Watch stream error")
            loop.call_soon_threadsafe(queue.put_nowait, None)
        finally:
            try:
                response.close()
            except Exception:
                pass

    loop.run_in_executor(_watch_executor, _read_stream)

    buffer = ""
    try:
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            buffer += chunk
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if line:
                    yield f"data: {line}\n\n"
    finally:
        try:
            response.close()
        except Exception:
            pass
