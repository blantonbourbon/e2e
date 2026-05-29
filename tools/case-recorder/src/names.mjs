export function validateSlug(value, label) {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error(`${label} must match /^[a-z][a-z0-9-]*$/: ${value}`);
  }
}

export function toPascalCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function humanize(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function javaString(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

export function gherkinString(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
