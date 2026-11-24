# paseo-opencode-copilot-usage

A [Paseo](https://paseo.sh) usage source that shows the GitHub Copilot premium quota of the account logged in via OpenCode (used, remaining, reset date) in the Usage panel.

It reads the GitHub OAuth login that [OpenCode](https://opencode.ai) keeps for `github-copilot` in `auth.json` (`~/.local/share/opencode/auth.json`) and calls `GET https://api.github.com/copilot_internal/user`. That endpoint is undocumented and may change.

## Install

```sh
npm install
paseo plugin install "$PWD"
```

Requires Paseo `>=0.9.2`.
