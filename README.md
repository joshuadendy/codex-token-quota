# Codex Quota Bar

A VS Code status-bar extension for monitoring Codex token quotas.

## Install

Send the packaged `.vsix` file to the user, then install it with:

```sh
code --install-extension codex-quota-bar-0.0.5.vsix --force
```

To build the `.vsix` from source:

```sh
git clone https://github.com/joshuadendy/codex-token-quota.git
cd codex-token-quota
npx @vscode/vsce package
```

The Codex CLI must also be installed and signed in on the user's computer.
