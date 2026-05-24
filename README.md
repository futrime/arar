# Auto-Research with Agent Review

When coding agents are saying "done", it may not be really done. They may be trying to finish prematurely to avoid doing more work, or they may have made a mistake and need to fix it. **Auto-Research with Agent Review (arar)** adds a reviewer agent that checks the work and gives feedback, allowing the coding agent to iterate until it is truly done.

## Install

Prerequisites:

- Codex CLI or Claude Code
- Node.js and npm

In the project where you want **arar** enabled:

```bash
npx github:futrime/arar
```

Pass `--must` to install in **must** mode, where the reviewer's `failed` verdict is also treated as not-done — the coding agent must keep iterating until the reviewer judges the task `complete`:

```bash
npx github:futrime/arar --must
```

After installation, run Codex once interactively in that repository and approve trust, otherwise hooks will not load.

## Usage

Run Codex or Claude Code as usual, and ask it to do something.

To harness the power of **arar**, we recommend writing the task in a `TASK.md` file in this format:

```md
# TASK.md

<!-- Describe the task you want the agent to accomplish. -->

## Context

<!-- Provide any relevant context, such as the project description, requirements, constraints, or references. -->

## Constraints

<!-- List any constraints that the agent must adhere to, such as time limits, resource limits, or specific rules. -->

- MUST ...
- MUST NOT ...

## Acceptance Criteria

<!-- Define the acceptance criteria that the agent's work will be evaluated against. -->

- [ ] ...

## (Optional) Steps

<!-- Outline the steps that the agent should follow to accomplish the task. -->
1. ...
```

Then, prompt the agent with `Accomplish the task described in TASK.md and ensure all constraints and acceptance criteria are met`.

## Contributing

Contributions are welcome.

Please open an issue first for major changes so implementation direction can be aligned early.

## License

[MIT](LICENSE) © Zijian Zhang
