{
  description = "Robin dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};

      # --- Helper scripts managed via PID files in .dev/ ---

      startScript = pkgs.writeShellScriptBin "start" ''
        set -euo pipefail
        ROBIN_DEV_DIR="''${ROBIN_DEV_DIR:-.dev}"

        PG_DATA="$ROBIN_DEV_DIR/postgres/data"
        PG_SOCKET="$ROBIN_DEV_DIR/postgres/socket"
        PG_LOG="$ROBIN_DEV_DIR/postgres/postgres.log"
        PG_PID="$ROBIN_DEV_DIR/postgres/postgres.pid"

        REDIS_DATA="$ROBIN_DEV_DIR/redis/data"
        REDIS_LOG="$ROBIN_DEV_DIR/redis/redis.log"
        REDIS_PID="$ROBIN_DEV_DIR/redis/redis.pid"

        mkdir -p "$PG_DATA" "$PG_SOCKET" "$REDIS_DATA"

        # ── PostgreSQL ──────────────────────────────────────────
        pg_running=false
        if [ -f "$PG_PID" ] && kill -0 "$(cat "$PG_PID")" 2>/dev/null; then
          pg_running=true
          echo "postgres: already running (pid $(cat "$PG_PID"))"
        fi

        if [ "$pg_running" = false ]; then
          if [ ! -f "$PG_DATA/PG_VERSION" ]; then
            echo "postgres: initializing data directory..."
            ${pkgs.postgresql_16}/bin/initdb \
              --pgdata="$PG_DATA" \
              --username=postgres \
              --auth=trust \
              --no-locale \
              --encoding=UTF8 \
              > /dev/null

            cat >> "$PG_DATA/postgresql.conf" <<PGCONF
listen_addresses = '127.0.0.1'
port = 5432
unix_socket_directories = '$PG_SOCKET'
log_destination = 'stderr'
logging_collector = off
PGCONF
          fi

          echo "postgres: starting..."
          ${pkgs.postgresql_16}/bin/pg_ctl start \
            -D "$PG_DATA" \
            -l "$PG_LOG" \
            -w \
            -o "-k $PG_SOCKET"

          head -1 "$PG_DATA/postmaster.pid" > "$PG_PID"

          if ! ${pkgs.postgresql_16}/bin/psql -h 127.0.0.1 -U postgres -lqt 2>/dev/null | grep -qw robinwiki; then
            echo "postgres: creating database robinwiki..."
            ${pkgs.postgresql_16}/bin/createdb -h 127.0.0.1 -U postgres robinwiki
          fi

          echo "postgres: ready (pid $(cat "$PG_PID"))"
        fi

        # ── Redis ───────────────────────────────────────────────
        redis_running=false
        if [ -f "$REDIS_PID" ] && kill -0 "$(cat "$REDIS_PID")" 2>/dev/null; then
          redis_running=true
          echo "redis:    already running (pid $(cat "$REDIS_PID"))"
        fi

        if [ "$redis_running" = false ]; then
          echo "redis:    starting..."
          ${pkgs.redis}/bin/redis-server \
            --daemonize yes \
            --pidfile "$(realpath "$REDIS_PID" 2>/dev/null || echo "$PWD/$REDIS_PID")" \
            --dir "$REDIS_DATA" \
            --logfile "$(realpath "$REDIS_LOG" 2>/dev/null || echo "$PWD/$REDIS_LOG")" \
            --appendonly yes \
            --save "" \
            --bind 127.0.0.1 \
            --port 6379

          for i in $(seq 1 10); do
            [ -f "$REDIS_PID" ] && break
            sleep 0.2
          done

          if [ -f "$REDIS_PID" ]; then
            echo "redis:    ready (pid $(cat "$REDIS_PID"))"
          else
            echo "redis:    started but PID file not found"
          fi
        fi

        # ── Core (Robin API server) ────────────────────────────
        CORE_PID="$ROBIN_DEV_DIR/core/core.pid"
        CORE_LOG="$ROBIN_DEV_DIR/core/core.log"
        mkdir -p "$ROBIN_DEV_DIR/core"
        if [ -f "$CORE_PID" ] && kill -0 "$(cat "$CORE_PID")" 2>/dev/null; then
          echo "core:     already running (pid $(cat "$CORE_PID"))"
        else
          echo "core:     starting..."
          (cd "$PROJECT_ROOT" && pnpm --filter @robin/core dev >> "$CORE_LOG" 2>&1) &
          echo $! > "$CORE_PID"
          for i in $(seq 1 30); do
            if ${pkgs.curl}/bin/curl -sf http://localhost:3000/health > /dev/null 2>&1; then
              echo "core:     ready (pid $(cat "$CORE_PID"))"
              break
            fi
            if [ "$i" = "30" ]; then
              echo "core:     started (pid $(cat "$CORE_PID")) but health check not responding"
            fi
            sleep 1
          done
        fi

        # ── Wiki (Next.js frontend) ────────────────────────────
        WIKI_PID="$ROBIN_DEV_DIR/wiki/wiki.pid"
        WIKI_LOG="$ROBIN_DEV_DIR/wiki/wiki.log"
        mkdir -p "$ROBIN_DEV_DIR/wiki"
        if [ -f "$WIKI_PID" ] && kill -0 "$(cat "$WIKI_PID")" 2>/dev/null; then
          echo "wiki:     already running (pid $(cat "$WIKI_PID"))"
        else
          echo "wiki:     starting..."
          (cd "$PROJECT_ROOT" && pnpm --filter @robin/wiki dev -- -p 8080 >> "$WIKI_LOG" 2>&1) &
          echo $! > "$WIKI_PID"
          for i in $(seq 1 30); do
            if ${pkgs.curl}/bin/curl -sf http://localhost:8080 > /dev/null 2>&1; then
              echo "wiki:     ready (pid $(cat "$WIKI_PID"))"
              break
            fi
            if [ "$i" = "30" ]; then
              echo "wiki:     started (pid $(cat "$WIKI_PID")) but not responding"
            fi
            sleep 1
          done
        fi

        echo ""
        echo "  core → http://localhost:3000"
        echo "  wiki → http://localhost:8080"
        echo ""
      '';

      stopScript = pkgs.writeShellScriptBin "stop" ''
        set -euo pipefail
        ROBIN_DEV_DIR="''${ROBIN_DEV_DIR:-.dev}"

        PG_DATA="$ROBIN_DEV_DIR/postgres/data"
        PG_PID="$ROBIN_DEV_DIR/postgres/postgres.pid"
        REDIS_PID="$ROBIN_DEV_DIR/redis/redis.pid"
        CORE_PID="$ROBIN_DEV_DIR/core/core.pid"
        WIKI_PID="$ROBIN_DEV_DIR/wiki/wiki.pid"

        stop_port() {
          local label=$1 port=$2 pidfile=$3
          local pids
          pids=$(${pkgs.lsof}/bin/lsof -ti:"$port" 2>/dev/null) || true
          if [ -n "$pids" ]; then
            echo "$label stopping..."
            echo "$pids" | xargs kill 2>/dev/null || true
            for i in $(seq 1 15); do
              pids=$(${pkgs.lsof}/bin/lsof -ti:"$port" 2>/dev/null) || true
              [ -z "$pids" ] && break
              sleep 0.2
            done
            pids=$(${pkgs.lsof}/bin/lsof -ti:"$port" 2>/dev/null) || true
            if [ -n "$pids" ]; then
              echo "$pids" | xargs kill -9 2>/dev/null || true
            fi
            echo "$label stopped"
          fi
          rm -f "$pidfile"
        }

        # ── Apps (reverse order: wiki → core) ──────────────────
        stop_port "wiki: " 8080 "$WIKI_PID"
        stop_port "core: " 3000 "$CORE_PID"

        # ── PostgreSQL ──────────────────────────────────────────
        if [ -f "$PG_PID" ] && kill -0 "$(cat "$PG_PID")" 2>/dev/null; then
          echo "postgres: stopping..."
          ${pkgs.postgresql_16}/bin/pg_ctl stop -D "$PG_DATA" -m fast
          rm -f "$PG_PID"
          echo "postgres: stopped"
        else
          echo "postgres: not running"
          rm -f "$PG_PID"
        fi

        # ── Redis ───────────────────────────────────────────────
        if [ -f "$REDIS_PID" ] && kill -0 "$(cat "$REDIS_PID")" 2>/dev/null; then
          echo "redis:    stopping..."
          ${pkgs.redis}/bin/redis-cli -h 127.0.0.1 -p 6379 shutdown nosave 2>/dev/null || true
          rm -f "$REDIS_PID"
          echo "redis:    stopped"
        else
          echo "redis:    not running"
          rm -f "$REDIS_PID"
        fi
      '';

      statusScript = pkgs.writeShellScriptBin "status" ''
        set -euo pipefail
        ROBIN_DEV_DIR="''${ROBIN_DEV_DIR:-.dev}"

        PG_PID="$ROBIN_DEV_DIR/postgres/postgres.pid"
        REDIS_PID="$ROBIN_DEV_DIR/redis/redis.pid"
        CORE_PID="$ROBIN_DEV_DIR/core/core.pid"
        WIKI_PID="$ROBIN_DEV_DIR/wiki/wiki.pid"

        if [ -f "$PG_PID" ] && kill -0 "$(cat "$PG_PID")" 2>/dev/null; then
          if ${pkgs.postgresql_16}/bin/pg_isready -h 127.0.0.1 -p 5432 -U postgres -q 2>/dev/null; then
            echo "postgres: UP (pid $(cat "$PG_PID"), accepting connections)"
          else
            echo "postgres: UP (pid $(cat "$PG_PID"), NOT accepting connections)"
          fi
        else
          echo "postgres: DOWN"
        fi

        if [ -f "$REDIS_PID" ] && kill -0 "$(cat "$REDIS_PID")" 2>/dev/null; then
          if ${pkgs.redis}/bin/redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG; then
            echo "redis:    UP (pid $(cat "$REDIS_PID"), responding to PING)"
          else
            echo "redis:    UP (pid $(cat "$REDIS_PID"), NOT responding)"
          fi
        else
          echo "redis:    DOWN"
        fi

        if [ -f "$CORE_PID" ] && kill -0 "$(cat "$CORE_PID")" 2>/dev/null; then
          if ${pkgs.curl}/bin/curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            echo "core:     UP (pid $(cat "$CORE_PID"), healthy)"
          else
            echo "core:     UP (pid $(cat "$CORE_PID"), NOT healthy)"
          fi
        else
          echo "core:     DOWN"
        fi

        if [ -f "$WIKI_PID" ] && kill -0 "$(cat "$WIKI_PID")" 2>/dev/null; then
          if ${pkgs.curl}/bin/curl -sf http://localhost:8080 > /dev/null 2>&1; then
            echo "wiki:     UP (pid $(cat "$WIKI_PID"), healthy)"
          else
            echo "wiki:     UP (pid $(cat "$WIKI_PID"), NOT healthy)"
          fi
        else
          echo "wiki:     DOWN"
        fi
      '';

      logsScript = pkgs.writeShellScriptBin "logs" ''
        set -euo pipefail
        ROBIN_DEV_DIR="''${ROBIN_DEV_DIR:-.dev}"

        case "''${1:-}" in
          "")
            echo "tailing all logs (ctrl-c to stop)..."
            tail -f \
              "$ROBIN_DEV_DIR/postgres/postgres.log" \
              "$ROBIN_DEV_DIR/redis/redis.log" \
              "$ROBIN_DEV_DIR/core/core.log" \
              "$ROBIN_DEV_DIR/wiki/wiki.log" \
              2>/dev/null
            ;;
          postgres)
            tail -f "$ROBIN_DEV_DIR/postgres/postgres.log" ;;
          redis)
            tail -f "$ROBIN_DEV_DIR/redis/redis.log" ;;
          core)
            tail -f "$ROBIN_DEV_DIR/core/core.log" ;;
          wiki)
            tail -f "$ROBIN_DEV_DIR/wiki/wiki.log" ;;
          *)
            echo "usage: logs [postgres|redis|core|wiki]"
            exit 1
            ;;
        esac
      '';

    in {
      devShells.${system} = {
        default = pkgs.mkShell {
          name = "robin";

          packages = [
            # Runtimes
            pkgs.nodejs_22
            pkgs.pnpm_10

            # Services
            pkgs.postgresql_16
            pkgs.redis
            pkgs.caddy

            # System tools
            pkgs.git
            pkgs.openssl
            pkgs.curl
            pkgs.jq
            pkgs.lsof

            # Dev service management
            startScript
            stopScript
            statusScript
            logsScript
          ];

          shellHook = ''
            export ROBIN_DEV_DIR="$PWD/.dev"
            export PROJECT_ROOT="$PWD"

            echo ""
            echo "  robin dev shell"
            echo "  run 'start' to launch postgres + redis + core + wiki"
            echo "  run 'stop' to shut everything down"
            echo "  run 'status' to check service health"
            echo "  run 'logs [service]' to tail logs"
            echo ""
          '';
        };
      };
    };
}
