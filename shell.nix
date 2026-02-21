let
  tarball = fetchTarball { url = "https://github.com/NixOS/nixpkgs/archive/nixos-unstable.tar.gz"; };
  nixpkgs = import tarball {};
in with nixpkgs; mkShell {
  buildInputs = [
    deno
    nodejs_24
  ];

  shellHook = ''
    echo "🚀 Starting development environment..."
    export COMPOSE_PROJECT_NAME="irf"
  '';
}
