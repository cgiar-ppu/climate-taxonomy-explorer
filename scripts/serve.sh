#!/usr/bin/env bash
# Serve dist/ on 127.0.0.1 (default port 8408), detached so it survives the shell.
#   scripts/serve.sh start | stop | status | restart
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8408}"
DIR="$(pwd)/dist"
PIDFILE="$(pwd)/.serve-${PORT}.pid"
LOG="$(pwd)/.serve-${PORT}.log"

listening() { lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true; }

case "${1:-status}" in
  start)
    if [ -n "$(listening)" ]; then echo "port $PORT already in use (pid $(listening))"; exit 1; fi
    [ -f "$DIR/index.html" ] || { echo "no build in $DIR - run npm run build"; exit 1; }
    nohup python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR" > "$LOG" 2>&1 &
    echo $! > "$PIDFILE"
    sleep 1
    echo "serving $DIR on http://127.0.0.1:$PORT/ (pid $(cat "$PIDFILE"))" ;;
  stop)
    if [ -f "$PIDFILE" ]; then kill "$(cat "$PIDFILE")" 2>/dev/null || true; rm -f "$PIDFILE"; fi
    echo "stopped" ;;
  restart) "$0" stop; sleep 1; "$0" start ;;
  status)
    p="$(listening)"; if [ -n "$p" ]; then echo "listening on $PORT (pid $p)"; else echo "not running"; fi ;;
  *) echo "usage: $0 start|stop|status|restart"; exit 2 ;;
esac
