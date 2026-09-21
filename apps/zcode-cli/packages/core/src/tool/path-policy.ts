// ============================================================
// Tool Path Policy
// ============================================================

import { basename, isAbsolute, normalize, relative, resolve, sep } from "node:path";
import { CoreErrorType, createCoreError } from "@zcode/contracts";

const SENSITIVE_DIRECTORY_NAMES = new Set([
  ".git",
  ".ssh",
  ".aws",
  ".gnupg",
  ".kube",
]);

const SENSITIVE_FILE_NAMES = new Set([
  ".git-credentials",
  ".netrc",
  ".npmrc",
  ".pypirc",
]);

const SAFE_ENV_TEMPLATE_FILES = new Set([
  ".env.example",
  ".env.sample",
  ".env.template",
  ".env.hardened.example",
]);

interface ToolWorkspacePathOptions {
  inputPath: string;
  workingDirectory: string;
  workspaceRoot: string;
  operation: "read" | "write" | "execute";
}

export function resolveWorkspacePath(options: ToolWorkspacePathOptions): string {
  const workingDirectory = normalizeAbsoluteDirectory(
    options.workingDirectory,
    "workingDirectory",
  );
  const workspaceRoot = normalizeAbsoluteDirectory(options.workspaceRoot, "workspaceRoot");
  const requestedPath = options.inputPath;

  if (requestedPath.length === 0) {
    throw createCoreError(CoreErrorType.ToolExecutionFailed, "Tool path must not be empty", {
      context: {
        operation: options.operation,
      },
      recoverable: true,
    });
  }

  const resolvedPath = isAbsolute(requestedPath)
    ? normalize(requestedPath)
    : resolve(workingDirectory, requestedPath);

  assertPathInsideWorkspace(resolvedPath, workspaceRoot, options.operation);
  assertPathIsNotSensitive(resolvedPath, workspaceRoot, options.operation);

  return resolvedPath;
}

export function resolveToolWorkingDirectory(
  inputCwd: string | undefined,
  options: Omit<ToolWorkspacePathOptions, "inputPath">,
): string {
  if (!inputCwd) {
    const workingDirectory = normalizeAbsoluteDirectory(
      options.workingDirectory,
      "workingDirectory",
    );
    normalizeAbsoluteDirectory(options.workspaceRoot, "workspaceRoot");
    return workingDirectory;
  }

  return resolveWorkspacePath({
    ...options,
    inputPath: inputCwd,
  });
}

function normalizeAbsoluteDirectory(value: string, label: string): string {
  const normalized = normalize(value);
  if (!isAbsolute(normalized)) {
    throw createCoreError(
      CoreErrorType.ConfigurationError,
      `${label} must be an absolute path for tool execution`,
      {
        context: {
          [label]: value,
        },
        recoverable: false,
      },
    );
  }
  return normalized;
}


function assertPathInsideWorkspace(
  resolvedPath: string,
  workspaceRoot: string,
  operation: ToolWorkspacePathOptions["operation"],
): void {
  const workspaceRelativePath = relative(workspaceRoot, resolvedPath);
  const outsideWorkspace =
    workspaceRelativePath === ".." ||
    workspaceRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(workspaceRelativePath);

  if (!outsideWorkspace) return;

  throw createCoreError(
    CoreErrorType.ToolExecutionFailed,
    "Hardened mode blocks tool access outside the active workspace",
    {
      context: { operation },
      recoverable: true,
    },
  );
}

function assertPathIsNotSensitive(
  resolvedPath: string,
  workspaceRoot: string,
  operation: ToolWorkspacePathOptions["operation"],
): void {
  const workspaceRelativePath = relative(workspaceRoot, resolvedPath);
  const segments = workspaceRelativePath
    .split(/[\\/]+/u)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

  if (segments.some((segment) => SENSITIVE_DIRECTORY_NAMES.has(segment))) {
    throwSensitivePathError(operation);
  }

  const fileName = basename(resolvedPath).toLowerCase();
  if (SENSITIVE_FILE_NAMES.has(fileName)) {
    throwSensitivePathError(operation);
  }

  if (
    (fileName === ".env" || fileName.startsWith(".env.")) &&
    !SAFE_ENV_TEMPLATE_FILES.has(fileName)
  ) {
    throwSensitivePathError(operation);
  }
}

function throwSensitivePathError(operation: ToolWorkspacePathOptions["operation"]): never {
  throw createCoreError(
    CoreErrorType.ToolExecutionFailed,
    "Hardened mode blocks Agent file access to sensitive credentials or VCS metadata",
    {
      context: { operation },
      recoverable: true,
    },
  );
}
