import path from "node:path";
import fs from "node:fs";

const CORE_EXTENSIONS = [".dylib", ".dll", ".so"];

/**
 * Validate that a file path is absolute, exists, and resolves to a location
 * within one of the allowed base directories. Prevents path traversal attacks
 * where a crafted path like "/allowed/../etc/passwd" escapes the sandbox.
 */
function validatePathWithinDirs(filePath: string, allowedDirs: Array<string>): string {
  if (!path.isAbsolute(filePath)) {
    throw new Error(`Path must be absolute: ${filePath}`);
  }

  const resolved = path.resolve(filePath);

  const withinAllowed = allowedDirs.some((dir) => {
    const resolvedDir = path.resolve(dir);
    return resolved.startsWith(resolvedDir + path.sep) || resolved === resolvedDir;
  });

  if (!withinAllowed) {
    throw new Error(`Path is outside allowed directories: ${resolved}`);
  }

  return resolved;
}

/**
 * Resolve an untrusted, possibly percent-encoded relative path (e.g. the path
 * part of a custom protocol URL) against a base directory. Returns the
 * absolute path, or null if it is malformed or would escape the directory.
 *
 * Decoding happens before the containment check so that encoded traversal
 * like "%2e%2e/" cannot slip past it and be decoded later by a file:// fetch.
 */
export function resolvePathWithinDir(baseDir: string, untrustedPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(untrustedPath);
  } catch {
    return null;
  }

  if (decoded.includes("\0")) {
    return null;
  }

  const resolvedDir = path.resolve(baseDir);
  const resolved = path.resolve(resolvedDir, decoded);
  const relative = path.relative(resolvedDir, resolved);

  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }

  return resolved;
}

/**
 * Validate a libretro core path. Ensures it:
 * - Is an absolute path
 * - Resolves within one of the allowed core directories
 * - Has a valid shared library extension (.dylib, .dll, .so)
 * - Exists on disk
 */
export function validateCorePath(corePath: string, allowedCoreDirs: Array<string>): string {
  const resolved = validatePathWithinDirs(corePath, allowedCoreDirs);

  const ext = path.extname(resolved).toLowerCase();
  if (!CORE_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Invalid core file extension "${ext}". Expected one of: ${CORE_EXTENSIONS.join(", ")}`,
    );
  }

  if (!fs.existsSync(resolved)) {
    throw new Error(`Core file does not exist: ${resolved}`);
  }

  return resolved;
}

/**
 * Validate a ROM file path. Ensures it:
 * - Is an absolute path
 * - Resolves without traversal to an existing file
 * - Exists on disk
 */
export function validateRomPath(romPath: string): string {
  if (!path.isAbsolute(romPath)) {
    throw new Error(`ROM path must be absolute: ${romPath}`);
  }

  const resolved = path.resolve(romPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`ROM file does not exist: ${resolved}`);
  }

  // Ensure it's a file, not a directory
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`ROM path is not a file: ${resolved}`);
  }

  return resolved;
}
