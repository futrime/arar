#!/usr/bin/env node

import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = process.cwd();

const MUST_MODE = process.argv.includes("--must");

function buildStopHook(command) {
    const fullCommand = MUST_MODE ? `${command} --must` : command;
    return {
        hooks: [
            {
                type: "command",
                command: fullCommand,
            },
        ],
    };
}

function installFlavor({ srcDir, dstDir, settingsFile, hookCommand }) {
    cpSync(join(srcDir, "hooks", "arar"), join(dstDir, "hooks", "arar"), { recursive: true });

    const settingsPath = join(dstDir, settingsFile);
    const target = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
    target.hooks ??= {};

    const entry = buildStopHook(hookCommand);
    const list = (target.hooks.Stop ??= []);
    const key = JSON.stringify(entry);
    if (!list.some((existing) => JSON.stringify(existing) === key)) {
        list.push(entry);
    }

    writeFileSync(settingsPath, `${JSON.stringify(target, null, 2)}\n`);
}

installFlavor({
    srcDir: join(pkgRoot, "codex"),
    dstDir: join(cwd, ".codex"),
    settingsFile: "hooks.json",
    hookCommand: "node .codex/hooks/arar/main.js",
});

installFlavor({
    srcDir: join(pkgRoot, "claude"),
    dstDir: join(cwd, ".claude"),
    settingsFile: "settings.json",
    hookCommand: "node .claude/hooks/arar/main.js",
});
