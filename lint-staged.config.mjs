import path from "node:path"

/**
 * Run each workspace ESLint only on staged files (paths relative to that package).
 * @param {string} workspace
 * @param {string[]} files
 */
function workspaceEslint(workspace, files) {
  const rel = files
    .map(file => path.relative(workspace, file).split(path.sep).join("/"))
    .filter(file => file && !file.startsWith(".."))
  if (rel.length === 0) return []
  const quoted = rel.map(file => `"${file.replaceAll('"', '\\"')}"`).join(" ")
  return `npm exec -w ${workspace} -- eslint ${quoted}`
}

export default {
  "frontend/**/*.{js,jsx,ts,tsx}": files => workspaceEslint("frontend", files),
  "backend/**/*.{js,cjs,mjs}": files => workspaceEslint("backend", files),
}
