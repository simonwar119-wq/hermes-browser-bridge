#!/usr/bin/env python3
"""
Hermes Browser Bridge Server — v1.1
架构: Hermes Agent(me) → HTTP POST → Bridge Server → WebSocket → Chrome Extension
              ↕ (agent 轮询)                         ↕ (扩展推送)
            pending_actions_queue          context_menu_action / tab_changed
依赖: python3 内置 + websockets 库

用法: python3 bridge-server.py [--port 8642]
"""

import asyncio
import json
import logging
import threading
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime

try:
    import websockets
    from websockets.server import serve as ws_serve
except ImportError:
    print("缺少依赖: pip3 install websockets")
    import sys; sys.exit(1)

# ============================================================
PORT = 8642       # HTTP API (agent 调用)
WS_PORT = 8643    # WebSocket (extension 连接)
TIMEOUT = 60

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s', datefmt='%H:%M:%S')
log = logging.getLogger('bridge')

# 全局状态（跨线程共享）
ext_ws = None
ext_connected = False
pending = {}        # request_id -> asyncio.Event
responses = {}      # request_id -> dict
ws_loop = None      # asyncio event loop (WebSocket线程)

# 新增: 扩展推送给 Agent 的消息队列
pending_agent_actions = []      # list of dict (context_menu_action, tab_changed, etc.)
agent_actions_lock = threading.Lock()

# ============================================================
# WebSocket: Extension 连接到这里
# ============================================================

async def handle_extension(ws):
    global ext_ws, ext_connected
    ext_ws = ws
    ext_connected = True
    log.info('⚡ Extension connected')

    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                msg_type = msg.get('type', '')

                if msg_type == 'browser_action_response':
                    # 命令响应 → 唤醒等待的 HTTP 请求
                    rid = msg.get('request_id')
                    if rid and rid in pending:
                        responses[rid] = msg
                        pending[rid].set()
                        pending.pop(rid, None)

                elif msg_type == 'context_menu_action':
                    # 用户右键菜单 → 存入队列供 Agent 轮询
                    with agent_actions_lock:
                        pending_agent_actions.append({
                            'type': 'context_menu_action',
                            'id': msg.get('request_id', uuid.uuid4().hex[:12]),
                            'data': msg.get('data', {}),
                            'timestamp': datetime.now().isoformat(),
                        })
                        # 最多保留 50 条
                        if len(pending_agent_actions) > 50:
                            pending_agent_actions = pending_agent_actions[-50:]
                    log.info(f'📋 Context menu action queued: {msg.get("data", {}).get("action", "?")}')

                elif msg_type == 'tab_changed':
                    # 标签页变化通知 → 存入队列
                    with agent_actions_lock:
                        pending_agent_actions.append({
                            'type': 'tab_changed',
                            'id': uuid.uuid4().hex[:12],
                            'data': msg.get('data', {}),
                            'timestamp': datetime.now().isoformat(),
                        })
                        if len(pending_agent_actions) > 50:
                            pending_agent_actions = pending_agent_actions[-50:]

                elif msg_type == 'ping':
                    # 心跳 → 回复 pong
                    try:
                        await ws.send(json.dumps({'type': 'pong'}))
                    except:
                        pass

                elif msg_type == 'pong':
                    # 心跳响应 — 无需处理
                    pass

                else:
                    log.debug(f'Unknown message type: {msg_type}')

            except json.JSONDecodeError:
                pass
    except:
        pass
    finally:
        ext_ws = None
        ext_connected = False
        for rid, evt in list(pending.items()):
            responses[rid] = {'status': 'error', 'error': 'Disconnected'}
            evt.set()
        pending.clear()
        log.info('⚡ Extension disconnected')

async def run_ws(host, port):
    async with ws_serve(handle_extension, host, port, ping_interval=30):
        log.info(f'  WebSocket: ws://{host}:{port}/extension')
        await asyncio.Future()  # run forever

def ws_thread_fn(host, port):
    global ws_loop
    ws_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(ws_loop)
    ws_loop.run_until_complete(run_ws(host, port))

# ============================================================
# HTTP: Agent 调用这里
# ============================================================

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # quiet

    def _json(self, code, data):
        b = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        path = urlparse(self.path).path

        if path == '/status':
            self._json(200, {
                'status': 'running',
                'extension_connected': ext_connected,
                'pending_requests': len(pending),
                'pending_actions': len(pending_agent_actions),
                'version': '1.1',
            })

        elif path == '/pending_actions':
            # Agent 轮询获取扩展推送的上下文菜单操作
            with agent_actions_lock:
                # 一次性取走所有待处理动作
                actions = list(pending_agent_actions)
                pending_agent_actions.clear()
            self._json(200, {
                'actions': actions,
                'count': len(actions),
            })

        elif path == '/pending_actions/peek':
            # 预览但不消费
            with agent_actions_lock:
                actions = list(pending_agent_actions)
            self._json(200, {
                'actions': actions[-10:],  # 只看最近10条
                'total': len(actions),
            })

        else:
            self._json(404, {'error': 'Not found. Available: /status, /pending_actions, /pending_actions/peek'})

    def do_POST(self):
        if urlparse(self.path).path != '/action':
            self._json(404, {'error': 'Not found'})
            return

        # 读请求体
        length = int(self.headers.get('Content-Length', 0))
        try:
            data = json.loads(self.rfile.read(length)) if length else {}
        except:
            self._json(400, {'error': 'Invalid JSON'})
            return

        action = data.get('action')
        params = data.get('params', {})
        rid = data.get('request_id', uuid.uuid4().hex[:12])

        if not action:
            self._json(400, {'error': 'Missing action'})
            return

        if not ext_connected or not ext_ws:
            self._json(503, {'error': 'Extension not connected'})
            return

        # 发送命令到扩展
        event = asyncio.Event()
        pending[rid] = event

        # 通过 ws_loop 发送（跨线程）
        async def send_cmd():
            try:
                await ext_ws.send(json.dumps({
                    'type': 'browser_action',
                    'action': action, 'params': params, 'request_id': rid
                }))
            except:
                pass

        if ws_loop and ws_loop.is_running():
            asyncio.run_coroutine_threadsafe(send_cmd(), ws_loop)
        else:
            pending.pop(rid, None)
            self._json(503, {'error': 'WebSocket loop not running'})
            return

        log.info(f'→ {action} ({rid})')

        # 同步等待结果
        import time
        deadline = time.time() + TIMEOUT
        while time.time() < deadline:
            if rid in responses:
                result = responses.pop(rid)
                status = result.get('status')
                if status == 'error':
                    log.warning(f'✕ {action} failed: {result.get("error","")}')
                    self._json(400, {'error': result.get('error', 'Command failed')})
                else:
                    log.info(f'✓ {action} done')
                    self._json(200, {'status': 'ok', 'data': result.get('data', {})})
                return
            time.sleep(0.05)  # 50ms 轮询

        pending.pop(rid, None)
        log.warning(f'✕ {action} timeout')
        self._json(408, {'error': f'Timeout after {TIMEOUT}s'})


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=PORT)
    parser.add_argument('--host', type=str, default='127.0.0.1')
    args = parser.parse_args()

    log.info(f'🚀 Hermes Bridge Server v1.1: {args.host}:{args.port}')

    # 启动 WebSocket 线程 (port + 1)
    t = threading.Thread(target=ws_thread_fn, args=(args.host, args.port + 1), daemon=True)
    t.start()

    # 启动 HTTP（主线程）
    httpd = HTTPServer((args.host, args.port), Handler)
    log.info(f'  HTTP API:   http://{args.host}:{args.port}/action')
    log.info(f'  WebSocket:  ws://{args.host}:{args.port + 1}/extension')
    log.info(f'  Status:     http://{args.host}:{args.port}/status')
    log.info(f'  Pending:    http://{args.host}:{args.port}/pending_actions')
    httpd.serve_forever()


if __name__ == '__main__':
    main()
