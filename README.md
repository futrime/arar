# arar

Auto-Research with Agent Review

When coding agents are saying "done", it may not be really done. They may be trying to finish prematurely to avoid doing more work, or they may have made a mistake and need to fix it. **arar** adds a reviewer agent that checks the work and gives feedback, allowing the coding agent to iterate until it is truly done.

## Install

Prerequisites:

- [Codex CLI](https://github.com/openai/codex) installed and available on PATH
- Python available on PATH

In the project where you want autopilot enabled:

```bash
npx github:futrime/arar
```

After installation, run Codex once interactively in that repository and approve trust, otherwise hooks will not load.

## Usage

Run Codex as usual, and ask it to do something.

## Contributing

Contributions are welcome.

Please open an issue first for major changes so implementation direction can be aligned early.

## License

[MIT](LICENSE) © Zijian Zhang
