{ pkgs, lib, config, inputs, ... }:

{
  # Environment name
  name = "ivokundotcom";

  # Environment variables
  env = {
    # Database configuration
    DATABASE_URL = "postgres://postgres:postgres@localhost:5432/ivokundotcom_dev?sslmode=disable";
    
    # Node environment
    NODE_ENV = "development";
  };

  # Packages available in the environment
  packages = with pkgs; [
    # Node.js and package managers
    nodejs_22
    bun
    
    # Database tools
    dbmate
    postgresql_16
    
    # Development utilities
    git
    jq
    curl
    
    # AWS tools (for DynamoDB local testing)
    awscli2
    
    # Native dependencies for sharp (image processing)
    vips
    pkg-config
  ];

  # LD_LIBRARY_PATH for native modules (sharp, etc.)
  env.LD_LIBRARY_PATH = lib.makeLibraryPath [
    pkgs.stdenv.cc.cc.lib
    pkgs.vips
  ];

  # Language-specific configurations
  languages = {
    typescript.enable = true;
    javascript = {
      enable = true;
      package = pkgs.nodejs_22;
    };
  };

  # Services
  services = {
    postgres = {
      enable = true;
      package = pkgs.postgresql_16;
      initialDatabases = [
        { name = "ivokundotcom_dev"; }
        { name = "ivokundotcom_test"; }
      ];
      initialScript = ''
        CREATE USER postgres WITH SUPERUSER PASSWORD 'postgres';
      '';
      listen_addresses = "127.0.0.1";
      port = 5432;
    };
  };

  # Scripts available in the shell
  scripts = {
    # Database migration commands
    db-new.exec = ''
      dbmate -d "./db/migrations" new "$@"
    '';
    db-up.exec = ''
      dbmate -d "./db/migrations" up
    '';
    db-down.exec = ''
      dbmate -d "./db/migrations" down
    '';
    db-status.exec = ''
      dbmate -d "./db/migrations" status
    '';
    db-dump.exec = ''
      dbmate -d "./db/migrations" dump
    '';
    db-reset.exec = ''
      dbmate -d "./db/migrations" drop
      dbmate -d "./db/migrations" up
    '';
    
    # Development helpers
    dev.exec = ''
      bun run dev
    '';
    build.exec = ''
      bun run build
    '';
    typecheck.exec = ''
      bun run typecheck
    '';

    # E2E Testing commands
    test-e2e.exec = ''
      echo "Setting up E2E test database..."
      DATABASE_URL="postgres://postgres:postgres@localhost:5432/ivokundotcom_test?sslmode=disable" \
        dbmate -d "./cms/db/migrations" up
      
      echo "Running E2E tests..."
      cd cms && DATABASE_URL="postgres://postgres:postgres@localhost:5432/ivokundotcom_test?sslmode=disable" \
        SESSION_SECRET="test-secret-min-32-chars-long-for-e2e-only!!!" \
        R2_ACCESS_KEY_ID="test" \
        R2_ACCESS_SECRET="test" \
        R2_ENDPOINT="http://localhost:9000" \
        R2_BUCKET="test-bucket" \
        R2_PUBLIC_URL="http://localhost:9000/test-bucket" \
        bun test src/e2e/
    '';
    
    test-e2e-watch.exec = ''
      cd cms && DATABASE_URL="postgres://postgres:postgres@localhost:5432/ivokundotcom_test?sslmode=disable" \
        SESSION_SECRET="test-secret-min-32-chars-long-for-e2e-only!!!" \
        R2_ACCESS_KEY_ID="test" \
        R2_ACCESS_SECRET="test" \
        R2_ENDPOINT="http://localhost:9000" \
        R2_BUCKET="test-bucket" \
        R2_PUBLIC_URL="http://localhost:9000/test-bucket" \
        bun test --watch src/e2e/
    '';
    
    test-unit.exec = ''
      echo "Running unit tests..."
      DATABASE_URL="postgres://postgres:postgres@localhost:5432/ivokundotcom_test?sslmode=disable" \
        bun --filter '@ivokundotcom/cms' test src/services/ src/middleware.test.ts src/schemas.test.ts src/errors.test.ts
    '';
  };

  # Pre-commit hooks disabled for now - can be enabled later
  # pre-commit.hooks = {
  #   prettier = {
  #     enable = true;
  #     excludes = [ "bun.lock" ];
  #   };
  # };

  # Testing — run with `devenv test`
  # Tasks are chained: migrate -> unit -> e2e -> enterTest
  tasks = {
    "test:migrate" = {
      exec = ''
        echo "Running CMS database migrations..."
        DATABASE_URL="postgres://postgres:postgres@localhost:$PGPORT/ivokundotcom_test?sslmode=disable" \
          dbmate -d "./cms/db/migrations" up
      '';
      before = [ "test:unit" ];
    };

    "test:unit" = {
      exec = ''
        echo "Running unit tests (with 5min timeout)..."
        DATABASE_URL="postgres://postgres:postgres@localhost:$PGPORT/ivokundotcom_test?sslmode=disable" \
          timeout 300 bun --filter '@ivokundotcom/cms' test src/services/ src/middleware.test.ts src/schemas.test.ts src/errors.test.ts
      '';
      before = [ "test:e2e" ];
    };

    "test:e2e" = {
      exec = ''
        echo "Running E2E tests (with 10min timeout)..."
        timeout 600 test-e2e
      '';
      before = [ "devenv:enterTest" ];
    };
  };

  enterTest = ''
    echo "✅ All tests completed."
  '';

  # Shell hook - runs when entering the environment
  enterShell = ''
    echo ""
    echo "  ivokundotcom development environment"
    echo "  ====================================="
    echo ""
    echo "  Node.js: $(node --version)"
    echo "  Bun:     $(bun --version)"
    echo "  dbmate:  $(dbmate --version)"
    echo ""
    echo "  Database commands:"
    echo "    db-new <name>  - Create a new migration"
    echo "    db-up          - Run pending migrations"
    echo "    db-down        - Rollback last migration"
    echo "    db-status      - Show migration status"
    echo "    db-reset       - Drop and recreate database"
    echo ""
    echo "  Development commands:"
    echo "    dev            - Start SST dev environment"
    echo "    build          - Build all services"
    echo "    typecheck      - Run TypeScript type checking"
    echo ""
    echo "  Testing commands:"
    echo "    test-unit      - Run unit tests only"
    echo "    test-e2e       - Run E2E tests"
    echo "    test-e2e-watch - Run E2E tests in watch mode"
    echo "    devenv test    - Run all tests (unit + E2E)"
    echo ""
  '';

  # Process management (for running services in development)
  processes = {
    # Uncomment to auto-start services
    # web.exec = "bun --filter web dev";
    # api.exec = "bun --filter api-hono dev";
  };
}
