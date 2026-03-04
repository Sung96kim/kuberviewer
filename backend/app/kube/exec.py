import asyncio
import logging
from collections.abc import Callable

from kubernetes import client
from kubernetes.stream import stream
from kubernetes.stream.ws_client import WSClient

from app.kube.manager import KubeManager

logger = logging.getLogger(__name__)

STDOUT_CHANNEL = 1
STDERR_CHANNEL = 2
ERROR_CHANNEL = 3


def open_exec_stream(
    namespace: str,
    pod_name: str,
    container: str | None = None,
    command: list[str] | None = None,
) -> WSClient:
    api_client = KubeManager.get_instance().get_api_client()
    core_v1 = client.CoreV1Api(api_client)

    cmd = command or ["env", "TERM=xterm", "/bin/bash"]

    ws_client: WSClient = stream(
        core_v1.connect_get_namespaced_pod_exec,
        pod_name,
        namespace,
        container=container or "",
        command=cmd,
        stderr=True,
        stdin=True,
        stdout=True,
        tty=True,
        _preload_content=False,
    )
    return ws_client


async def run_exec_bridge(
    namespace: str,
    pod_name: str,
    container: str | None,
    command: list[str] | None,
    send_output: Callable[[bytes], object],
    receive_input: Callable[[], object],
) -> None:
    loop = asyncio.get_event_loop()

    ws_client = await asyncio.to_thread(
        open_exec_stream, namespace, pod_name, container, command
    )

    try:
        async def read_from_k8s() -> None:
            while ws_client.is_open():
                try:
                    data = await asyncio.to_thread(ws_client.read_stdout, timeout=0.1)
                    if data:
                        await send_output(data.encode("utf-8") if isinstance(data, str) else data)
                except Exception:
                    break

                try:
                    err = await asyncio.to_thread(ws_client.read_stderr, timeout=0.01)
                    if err:
                        await send_output(err.encode("utf-8") if isinstance(err, str) else err)
                except Exception:
                    pass

        async def write_to_k8s() -> None:
            while ws_client.is_open():
                try:
                    data = await receive_input()
                    if data is None:
                        break
                    text = data.decode("utf-8") if isinstance(data, bytes) else data
                    await asyncio.to_thread(ws_client.write_stdin, text)
                except Exception:
                    break

        await asyncio.gather(read_from_k8s(), write_to_k8s())
    finally:
        ws_client.close()
