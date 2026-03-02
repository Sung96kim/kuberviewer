import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.kube.exec import open_exec_stream

logger = logging.getLogger(__name__)

router = APIRouter(tags=["exec"])


@router.websocket("/api/exec")
async def exec_terminal(
    ws: WebSocket,
    namespace: str = Query(...),
    pod: str = Query(...),
    container: str | None = Query(None),
) -> None:
    await ws.accept()

    loop = asyncio.get_event_loop()

    try:
        ws_client = await asyncio.to_thread(
            open_exec_stream, namespace, pod, container,
            ["env", "TERM=xterm", "/bin/bash", "-l"],
        )
    except Exception as e:
        await ws.send_text(json.dumps({"type": "error", "data": str(e)}))
        await ws.close()
        return

    closed = asyncio.Event()

    async def read_from_k8s() -> None:
        try:
            while not closed.is_set() and ws_client.is_open():
                data = await asyncio.to_thread(ws_client.read_stdout, timeout=0.1)
                if data:
                    await ws.send_bytes(data.encode("utf-8") if isinstance(data, str) else data)

                err_data = await asyncio.to_thread(ws_client.read_stderr, timeout=0.01)
                if err_data:
                    await ws.send_bytes(err_data.encode("utf-8") if isinstance(err_data, str) else err_data)
        except (WebSocketDisconnect, Exception):
            pass
        finally:
            closed.set()

    async def write_to_k8s() -> None:
        try:
            while not closed.is_set():
                message = await ws.receive()
                if message.get("type") == "websocket.disconnect":
                    break

                data = message.get("bytes") or message.get("text", "").encode("utf-8")
                if data:
                    msg = json.loads(data) if isinstance(data, bytes) and data.startswith(b"{") else None
                    if msg and msg.get("type") == "resize":
                        cols = msg.get("cols", 80)
                        rows = msg.get("rows", 24)
                        await asyncio.to_thread(
                            ws_client.write_channel, 4, json.dumps({"Width": cols, "Height": rows})
                        )
                    elif msg and msg.get("type") == "input":
                        await asyncio.to_thread(ws_client.write_stdin, msg["data"])
                    elif not msg:
                        text = data.decode("utf-8") if isinstance(data, bytes) else data
                        await asyncio.to_thread(ws_client.write_stdin, text)
        except (WebSocketDisconnect, Exception):
            pass
        finally:
            closed.set()

    try:
        await asyncio.gather(read_from_k8s(), write_to_k8s())
    finally:
        try:
            ws_client.close()
        except Exception:
            pass
