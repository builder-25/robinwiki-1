{
  description = "Robin dev environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      forAllSystems = f:
        nixpkgs.lib.genAttrs systems (system: f {
          inherit system;
          pkgs = import nixpkgs { inherit system; };
        });
    in {
      devShells = forAllSystems ({ pkgs, ... }: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm
            postgresql_16
            redis
            caddy
            jq
            openssl
          ];

          shellHook = ''
            echo "robin dev shell"
            echo "  node    $(node --version)"
            echo "  pnpm    $(pnpm --version)"
            echo "  pg      $(postgres --version | awk '{print $NF}')"
            echo "  redis   $(redis-server --version | awk '{print $3}' | cut -d= -f2)"
            echo "  caddy   $(caddy version | awk '{print $1}')"
          '';
        };
      });
    };
}
