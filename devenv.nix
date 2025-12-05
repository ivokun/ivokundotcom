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
  };

  # Pre-commit hooks disabled for now - can be enabled later
  # pre-commit.hooks = {
  #   prettier = {
  #     enable = true;
  #     excludes = [ "bun.lock" ];
  #   };
  # };

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
  '';

  # Process management (for running services in development)
  processes = {
    # Uncomment to auto-start services
    # web.exec = "bun --filter web dev";
    # api.exec = "bun --filter api-hono dev";
  };
}
