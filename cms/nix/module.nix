# NixOS module for ivokun CMS
# PRD Section 12.2 - NixOS Service Requirements
#
# Usage in your NixOS configuration:
# ```nix
# imports = [ ./path/to/cms/nix/module.nix ];
#
# services.ivokun-cms = {
#   enable = true;
#   domain = "cms.ivokun.com";
#   databaseUrl = "postgres://user:pass@localhost/cms";
#   environmentFile = "/run/secrets/cms.env";
# };
# ```

{ config, lib, pkgs, ... }:

let
  cfg = config.services.ivokun-cms;
in
{
  options.services.ivokun-cms = {
    enable = lib.mkEnableOption "ivokun CMS headless content management system";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
      description = "The CMS package to use";
    };

    domain = lib.mkOption {
      type = lib.types.str;
      example = "cms.example.com";
      description = "Domain name for the CMS";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port for the CMS server to listen on";
    };

    databaseUrl = lib.mkOption {
      type = lib.types.str;
      example = "postgres://user:password@localhost:5432/cms";
      description = "PostgreSQL connection URL";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      description = ''
        Path to environment file containing secrets.
        Should contain:
        - SESSION_SECRET
        - R2_ACCESS_KEY_ID
        - R2_ACCESS_SECRET
        - R2_ENDPOINT
        - R2_BUCKET
        - R2_PUBLIC_URL
      '';
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "ivokun-cms";
      description = "User account under which the CMS runs";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "ivokun-cms";
      description = "Group under which the CMS runs";
    };

    dataDir = lib.mkOption {
      type = lib.types.path;
      default = "/var/lib/ivokun-cms";
      description = "Directory for CMS data (uploads in dev mode)";
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Whether to open the firewall for the CMS port";
    };

    # Caddy integration
    caddy = {
      enable = lib.mkEnableOption "Caddy reverse proxy integration";

      extraConfig = lib.mkOption {
        type = lib.types.lines;
        default = "";
        description = "Extra Caddy configuration for the CMS virtual host";
      };
    };
  };

  config = lib.mkIf cfg.enable {
    # Create user and group
    users.users.${cfg.user} = {
      isSystemUser = true;
      group = cfg.group;
      home = cfg.dataDir;
      createHome = true;
      description = "ivokun CMS service user";
    };

    users.groups.${cfg.group} = { };

    # Systemd service with hardening
    systemd.services.ivokun-cms = {
      description = "ivokun CMS - Headless Content Management System";
      documentation = [ "https://github.com/ivokun/ivokundotcom" ];

      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" "postgresql.service" ];
      wants = [ "network-online.target" ];

      environment = {
        NODE_ENV = "production";
        PORT = toString cfg.port;
        DATABASE_URL = cfg.databaseUrl;
      };

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.dataDir;

        ExecStart = "${cfg.package}/bin/cms";
        Restart = "always";
        RestartSec = "5s";

        # Environment file for secrets
        EnvironmentFile = lib.mkIf (cfg.environmentFile != null) cfg.environmentFile;

        # Security hardening (PRD SEC-9.3)
        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictAddressFamilies = [ "AF_INET" "AF_INET6" "AF_UNIX" ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        LockPersonality = true;
        MemoryDenyWriteExecute = false; # Required for JIT
        SystemCallArchitectures = "native";
        SystemCallFilter = [ "@system-service" "~@privileged" ];

        # Write access for data directory
        ReadWritePaths = [ cfg.dataDir ];

        # Capabilities
        CapabilityBoundingSet = "";
        AmbientCapabilities = "";

        # Resource limits
        LimitNOFILE = 65536;
        LimitNPROC = 4096;

        # Logging
        StandardOutput = "journal";
        StandardError = "journal";
        SyslogIdentifier = "ivokun-cms";
      };
    };

    # Health check timer
    systemd.services.ivokun-cms-health = {
      description = "ivokun CMS health check";
      serviceConfig = {
        Type = "oneshot";
        ExecStart = "${pkgs.curl}/bin/curl -sf http://localhost:${toString cfg.port}/health";
      };
    };

    systemd.timers.ivokun-cms-health = {
      description = "ivokun CMS health check timer";
      wantedBy = [ "timers.target" ];
      timerConfig = {
        OnCalendar = "*:*:0/30"; # Every 30 seconds
        Unit = "ivokun-cms-health.service";
      };
    };

    # Firewall
    networking.firewall.allowedTCPPorts = lib.mkIf cfg.openFirewall [ cfg.port ];

    # Caddy reverse proxy
    services.caddy.virtualHosts = lib.mkIf cfg.caddy.enable {
      "${cfg.domain}" = {
        extraConfig = ''
          reverse_proxy localhost:${toString cfg.port}
          ${cfg.caddy.extraConfig}
        '';
      };
    };

    # Assertions
    assertions = [
      {
        assertion = cfg.environmentFile != null || cfg.databaseUrl != "";
        message = "ivokun-cms: Either environmentFile or databaseUrl must be set";
      }
    ];
  };
}
