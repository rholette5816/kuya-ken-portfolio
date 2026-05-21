type ProjectPath = {
  label: string;
  value: string;
};

function stripTicks(value: string) {
  return value.replace(/^`|`$/g, "").trim();
}

function joinWindowsPath(rootPath: string, relativePath: string) {
  const cleanRoot = rootPath.replace(/[\\/]+$/g, "");
  const cleanRelative = relativePath.replace(/^[\\/]+/g, "").replace(/\//g, "\\");
  return `${cleanRoot}\\${cleanRelative}`;
}

export function getProjectPaths(location: string, rootPath: string): ProjectPath[] {
  const quoted = [...String(location || "").matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  const rawParts = quoted.length
    ? quoted
    : String(location || "")
        .split(",")
        .map((part) => stripTicks(part))
        .filter(Boolean);

  return Array.from(new Set(rawParts))
    .map((part) => part.trim())
    .filter((part) => part && !part.includes("+"))
    .map((part) => ({
      label: part,
      value: joinWindowsPath(rootPath, part)
    }));
}
