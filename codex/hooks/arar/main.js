#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MUST_MODE = process.argv.includes("--must");

const JUDGE_SCHEMA = {
    type: "object",
    properties: {
        verdict: {
            type: "string",
            enum: ["complete", "incomplete", "failed", "suspended", "waiting"],
            description: "The current state of the task.",
        },
        reason: {
            type: "string",
            description:
                "A brief explanation of why this verdict was chosen, citing specific evidence from the conversation.",
        },
    },
    required: ["verdict", "reason"],
    additionalProperties: false,
};

const AUDIT_PROMPT = `You are a strict task-completion auditor. You will receive the latest assistant message and all user messages from a conversation between a user and a coding agent. You are running in the agent's working directory and may use shell tools (\`cat\`, \`ls\`, \`git status\`, \`git diff\`, etc.) to read files and verify the agent's claims against the actual state of the repository.

Determine whether the agent GENUINELY completed what the user asked. Rules:
- "complete": The working directory shows concrete evidence of real work (code changes on disk, command output, etc.) that matches the user request.
- "incomplete": The agent is stopping without finishing, or just claims completion without evidence on disk. Reward hacking must be classified as incomplete.
- "failed": Agent tried multiple approaches but hit an insurmountable blocker.
- "suspended": Agent legitimately needs user input or authorization to continue.
- "waiting": Agent is waiting for an external event or process to complete before it can proceed.

Be skeptical. Prefer concrete evidence from the file system over the agent's self-report — inspect the files the agent claims to have written, run \`git diff\` to see what actually changed, and read tests/output before deciding.`;

function emit(payload) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const emitBlock = (reason) => emit({ decision: "block", reason });
const emitContinue = () => emit({ continue: true });
const emitFail = (reason) => emit({ continue: false, stopReason: reason });

async function readStdin() {
    let data = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) data += chunk;
    return data;
}

function extractText(node) {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (typeof node === "object") {
        for (const key of ["content", "text", "message", "delta", "item"]) {
            if (key in node) return extractText(node[key]);
        }
        return "";
    }
    return String(node);
}

function* walkObjects(node) {
    if (node == null) return;
    if (Array.isArray(node)) {
        for (const v of node) yield* walkObjects(v);
        return;
    }
    if (typeof node !== "object") return;
    yield node;
    for (const v of Object.values(node)) yield* walkObjects(v);
}

function extractUserMessagesFromTranscript(path) {
    const lines = readFileSync(path, "utf8").split("\n");
    const messages = [];
    for (const line of lines) {
        if (!line) continue;
        let obj;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        for (const node of walkObjects(obj)) {
            if (node.role !== "user") continue;
            const text = ("content" in node ? extractText(node.content) : extractText(node)).trim();
            if (text) messages.push(text);
        }
    }
    if (messages.length === 0) return "";
    return messages.map((text, index) => `User message ${index + 1}:\n${text}`).join("\n\n");
}

function runCodex({ input, schemaFile, resultFile }) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            "codex",
            [
                "exec",
                AUDIT_PROMPT,
                "--ephemeral",
                "--skip-git-repo-check",
                "--disable",
                "hooks",
                "--output-schema",
                schemaFile,
                "-o",
                resultFile,
            ],
            { stdio: ["pipe", "ignore", "ignore"] },
        );
        child.once("error", reject);
        child.once("close", () => resolve());
        child.stdin.end(input);
    });
}

async function main() {
    const raw = await readStdin();
    let hookInput;
    try {
        hookInput = JSON.parse(raw);
    } catch {
        hookInput = {};
    }

    const lastAssistantMessage = hookInput.last_assistant_message ?? "";
    if (!lastAssistantMessage) {
        emitBlock("No assistant message found to judge. Please continue working");
        return;
    }

    const transcriptPath = hookInput.transcript_path;
    if (!transcriptPath || !existsSync(transcriptPath)) {
        emitFail("transcript_path is missing or invalid.");
        return;
    }

    let userMessages = "";
    try {
        userMessages = extractUserMessagesFromTranscript(transcriptPath);
    } catch {
        userMessages = "";
    }
    if (!userMessages) {
        emitFail("No user messages found.");
        return;
    }

    const tmpDir = mkdtempSync(join(tmpdir(), "arar-"));
    const schemaFile = join(tmpDir, "judge-schema.json");
    const resultFile = join(tmpDir, "result.json");
    writeFileSync(schemaFile, JSON.stringify(JUDGE_SCHEMA));
    const cleanup = () => {
        try {
            rmSync(tmpDir, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    };

    try {
        const codexInput = `Assistant message:\n${lastAssistantMessage}\n\nAll user messages:\n${userMessages}\n`;
        await runCodex({ input: codexInput, schemaFile, resultFile });

        let verdict = "incomplete";
        let reason = "No reason provided.";
        if (existsSync(resultFile)) {
            try {
                const parsed = JSON.parse(readFileSync(resultFile, "utf8"));
                if (typeof parsed.verdict === "string") verdict = parsed.verdict;
                if (typeof parsed.reason === "string") reason = parsed.reason;
            } catch {
                /* keep defaults */
            }
        }

        switch (verdict) {
            case "complete":
                emitContinue();
                break;
            case "failed":
                if (MUST_MODE) {
                    emitBlock(
                        `Reviewer judged the task as failed, but --must mode requires completion. Reason: ${reason} — Please continue working until the task is judged complete.`,
                    );
                } else {
                    emitContinue();
                }
                break;
            case "suspended":
                emitBlock(
                    "User is away and cannot respond. — Please think about what you can do next to make progress independently without waiting for user input.",
                );
                break;
            case "waiting":
                emitBlock(
                    "You are waiting for an external event or process. — Please estimate when you will be able to proceed, and wait with `sleep` at an appropriate interval.",
                );
                break;
            default:
                emitBlock(`Your task is not yet complete. Reason: ${reason} — Please continue working.`);
                break;
        }
    } finally {
        cleanup();
    }
}

main().catch((err) => {
    emitFail(`arar hook error: ${err?.message ?? String(err)}`);
});
