# Nix package derivation for ivokun CMS
# PRD Section 12.2 - NixOS Service Requirements
#
# This builds the CMS binary from source or installs a pre-built binary.
# The binary is a self-contained Bun executable with the admin SPA bundled.
#
# Usage:
#   nix-build -E 'with import <nixpkgs> {}; callPackage ./package.nix {}'
#
# Or in a flake:
#   packages.cms = pkgs.callPackage ./cms/nix/package.nix {};

{ lib
, stdenv
, fetchurl
, autoPatchelfHook
, makeWrapper
, bun
, nodejs_22
, sharp ? null  # Native dependency, installed separately
}:

let
  version = "1.0.0";
  
  # Platform-specific binary names
  binaryName = "cms";
  
  # For now, we build from source. Pre-built binaries can be added later.
  # Binary download URLs would be:
  # https://github.com/ivokun/ivokundotcom/releases/download/cms-v${version}/cms-linux-x64
  # https://github.com/ivokun/ivokundotcom/releases/download/cms-v${version}/cms-linux-arm64
  
in stdenv.mkDerivation rec {
  pname = "ivokun-cms";
  inherit version;

  # Build from source
  src = ./..;

  nativeBuildInputs = [
    bun
    nodejs_22
    makeWrapper
  ] ++ lib.optionals stdenv.isLinux [
    autoPatchelfHook
  ];

  buildInputs = [
    stdenv.cc.cc.lib  # libstdc++ for Bun runtime
  ];

  # Don't try to strip Bun binaries
  dontStrip = true;

  buildPhase = ''
    runHook preBuild
    
    # Install dependencies
    export HOME=$TMPDIR
    bun install --frozen-lockfile
    
    # Build SPA
    bun run build:spa
    
    # Build binary
    bun build src/server.ts \
      --compile \
      --target=bun \
      --outfile=$binaryName \
      --external @effect/cluster \
      --external sharp
    
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    
    mkdir -p $out/bin
    mkdir -p $out/share/ivokun-cms
    
    # Install binary
    cp $binaryName $out/bin/cms
    chmod +x $out/bin/cms
    
    # Install admin SPA
    cp -r public $out/share/ivokun-cms/
    
    # Install migrations
    cp -r db/migrations $out/share/ivokun-cms/
    
    # Wrap binary to set working directory and paths
    wrapProgram $out/bin/cms \
      --set CMS_PUBLIC_DIR "$out/share/ivokun-cms/public" \
      --set CMS_MIGRATIONS_DIR "$out/share/ivokun-cms/db/migrations"
    
    runHook postInstall
  '';

  meta = with lib; {
    description = "ivokun CMS - Headless content management system";
    homepage = "https://github.com/ivokun/ivokundotcom";
    license = licenses.mit;
    maintainers = [ ];
    platforms = platforms.linux ++ platforms.darwin;
    mainProgram = "cms";
  };
}
