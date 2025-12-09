@_default:
    just --list --justfile {{ justfile() }}

set export := true

# make sure we are using the jupnet build sbf
_ensure-solana-sbf:
    @if [ -z "$SOLANA_HOME" ]; then \
      echo "Error: SOLANA_HOME is not set. Please set it to your Solana installation directory."; \
      exit 1; \
    fi
    @$SOLANA_HOME/cargo-build-sbf --version | grep -q "solana" || (echo "Error: wrong cargo-build-sbf version $(which cargo-build-sbf)" && exit 1)


build-programs: _ensure-solana-sbf
    $SOLANA_HOME/cargo-build-sbf

# Run all tests in the workspace
test-all: build-programs
    SBF_OUT_DIR=$(pwd)/target/deploy cargo test

# Run tests specifically for the pinocchio token program
test-programs: build-programs
    SBF_OUT_DIR=$(pwd)/target/deploy cargo test -p pinocchio-token-program

# Run JavaScript client tests
test-js:
    pnpm clients:js:test
