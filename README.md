# EIPs Theme

Zola theme used by the Ethereum Improvement Proposal (EIP) site, including EIPs and ERCs. This repo contains the shared templates, Sass, static assets, syntax definitions, and Zola configuration used when rendering proposal content.

## Local Development

### Minimum Requirements

Local workspace commands require these tools on `PATH`:

* Git
* `build-eips`
* Zola 0.22.1

Git must be installed separately. The setup script locates or installs `build-eips` and Zola, adds locally installed tool directories to `PATH` for the current shell session, and prints guidance for making those `PATH` changes permanent.

### Bootstrap The Workspace

Run the setup script once from this repo.

Linux and macOS:

```sh
./scripts/dev-setup
```

Windows PowerShell:

```powershell
.\scripts\dev-setup.ps1
```

The setup script initializes the workspace one directory above this repo, runs `build-eips doctor`, and prints the next local commands.

After setup, the generated workspace guide is available at `../WORKSPACE.md`. Use that file for the full command reference and workspace details.

The script expects the theme repo to live inside the surrounding multi-repo workspace. After setup, the workspace has this layout:

```text
EIPs-project/
├── .build-eips.toml
├── WORKSPACE.md
├── .local-build/
├── EIPs/
├── ERCs/
└── theme/
```

The script anchors setup through `../EIPs` by default and clones `https://github.com/ethereum/EIPs.git` there when that checkout is missing. Set `ACTIVE_REPO_ROOT` to use another proposal repo checkout:

```sh
ACTIVE_REPO_ROOT=../ERCs ./scripts/dev-setup
```

Validate the workspace at any point with:

```sh
build-eips -C ../EIPs doctor
```

### Advanced Setup Options

Pass optional flags through the script when you want to work on the system tooling or an additional proposal repo:

```sh
./scripts/dev-setup --platform-dev
./scripts/dev-setup --template
./scripts/dev-setup --template --platform-dev
```

`--template` adds the optional `template/` proposal template repo. `--platform-dev` adds local `preprocessor/` and `eipw/` checkouts for build system development.

After setup, run local site commands against the active proposal repo:

```sh
build-eips -C ../EIPs check
build-eips -C ../EIPs serve
build-eips -C ../EIPs doctor
```

### Serve And Preview

Local serving keeps two distinct modes:

* `build-eips serve` for the runtime dev loop
* `build-eips preview` for serving already-built static output (`build-eips build` must be run first)

`build-eips serve` runs Zola's fast serve mode under the hood. It watches tracked edits in the active proposal repo and incrementally updates the local site for content changes.

It also watches tracked edits under `theme/` in the workspace. Theme changes can take longer to apply because they affect the whole rendered site. During `serve`, staging a new theme file with `git add` triggers a theme rescan; no extra file edit or restart should be needed.

`serve --clean` ignores active-repo dirty edits but still watches the local theme.

`build-eips preview` serves the resolved output directory for the active repo without invoking Zola, preprocessing markdown, or rebuilding anything. If the output directory does not exist yet, it fails and tells you to run `build-eips build` first.

### Local Server And Base URL

The `[server]` table in `.build-eips.toml` controls the local bind address for both `serve` and `preview`; the default is `127.0.0.1:1111`. Per-command `--host` and `--port` flags override `.build-eips.toml` for one run. These settings do not change build base URLs.

The `[site].base_url` value in `.build-eips.toml` is the default local rendered site URL. Starter `.build-eips.toml` files set it to `http://127.0.0.1:1111`. If you change `[server].port`, update `[site].base_url` too when generated links should match the local server.

Per-command `--base-url` on `build` or `serve` is a one-run override and wins over `.build-eips.toml`, including with staging or parity commands.

`preview` serves existing output, so build with `--base-url` first when previewed HTML should contain a different local link target.

### Target Specific Proposals

Full local `build` and `serve` runs can take time because they process every proposal file. Use targeted rendering when you only need to test a few proposals or theme changes against a small proposal set:

```bash
build-eips serve --only 555
build-eips build --only 555
build-eips build --only 555 678
```

You can also set a default target list in the workspace `.build-eips.toml`:

```toml
[render]
only = [555, 678]
```

CLI `--only` replaces `[render].only` for that run. For edge cases and exact filtering behavior, see `../WORKSPACE.md`.

### Source And Output Overrides

Workspace-local sources come from the standard workspace layout. The local theme is `workspace/theme`, and local sibling repos are `workspace/<sibling_repo_id>` from the active repo manifest.

Use `--remote-siblings` when you need to force remote sibling proposal sources for a single command.

Use global `--build-root <path>` when you want a separate prepared repo and output directory, for example to compare two builds side by side. The path replaces the default `.local-build/<repo_id>` location for each command where you pass it, so use the same `--build-root` value when serving or previewing builds.


Example:

```bash
build-eips -C /work/EIPs-project/EIPs --build-root /tmp/eips-local build --base-url http://127.0.0.1:1111
build-eips -C /work/EIPs-project/EIPs --build-root /tmp/eips-staging --staging build --base-url http://127.0.0.1:1112

build-eips -C /work/EIPs-project/EIPs --build-root /tmp/eips-local preview --port 1111
build-eips -C /work/EIPs-project/EIPs --build-root /tmp/eips-staging preview --port 1112

# Or using serve
build-eips -C /work/EIPs-project/EIPs --build-root /tmp/eips-local serve --port 1111
build-eips -C /work/EIPs-project/EIPs --build-root /tmp/eips-staging --staging serve --port 1112
```
