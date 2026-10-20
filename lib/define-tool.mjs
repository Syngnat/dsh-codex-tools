/**
 * A dependency-free `defineTool` equivalent.
 *
 * Harness plugins installed into a profile cannot rely on bare
 * `@deepseek-ai/*` specifiers resolving from the profile's `node_modules`, so
 * this module reproduces the small part of `@deepseek-ai/dsh-tools` that a tool
 * author needs: compile the author-facing parameter map into the raw JSON Schema
 * the registry stores, and hand back a registry-ready definition.
 *
 * The author-facing dialect matches the first-party helper: each parameter is a
 * value schema object, `required: true` marks it required, and `description`,
 * `title`, `default` and `examples` are annotations.
 *
 * @module dsh-codex-tools/define-tool
 */

/** Keys that are annotations rather than structural constraints. */
const ANNOTATION_KEYS = ["description", "title", "default", "examples"];

/**
 * Compile one author-facing value schema into raw JSON Schema.
 * @param spec - Author-facing value schema.
 * @returns Raw JSON Schema node.
 */
function valueSchema(spec) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    throw new Error("a value schema must be an object");
  }
  const node = {};
  for (const key of ANNOTATION_KEYS) {
    if (spec[key] !== undefined) node[key] = spec[key];
  }
  if (spec.oneOf !== undefined) {
    if (spec.type !== undefined) throw new Error("a value schema cannot declare both `type` and `oneOf`");
    node.oneOf = spec.oneOf.map(valueSchema);
    return node;
  }
  if (spec.type === undefined) throw new Error("a value schema must declare `type` or `oneOf`");
  node.type = spec.type;
  if (spec.enum !== undefined) node.enum = [...spec.enum];
  if (spec.const !== undefined) node.const = spec.const;
  if (spec.items !== undefined) node.items = valueSchema(spec.items);
  if (spec.properties !== undefined) {
    const compiled = propertyMap(spec.properties);
    node.properties = compiled.properties;
    if (compiled.required !== undefined) node.required = compiled.required;
  }
  return node;
}

/**
 * Compile a property map into `properties` plus an optional `required` list.
 * @param spec - Map of property name to author-facing value schema.
 * @returns `{ properties, required? }`.
 */
function propertyMap(spec) {
  const properties = {};
  const required = [];
  for (const [key, value] of Object.entries(spec)) {
    if (value === null || typeof value !== "object") throw new Error(`parameter "${key}" must be a value schema object`);
    if (value.required !== undefined && value.required !== true) {
      throw new Error(`parameter "${key}": \`required\` must be true when present`);
    }
    if (value.required === true) required.push(key);
    properties[key] = valueSchema(value);
  }
  return required.length === 0 ? { properties } : { properties, required };
}

/**
 * Compile the implicit open parameter object into raw JSON Schema.
 * @param spec - Per-property author-facing schemas.
 * @returns An object-rooted raw schema.
 */
export function parameterSchema(spec) {
  const compiled = propertyMap(spec);
  return {
    type: "object",
    properties: compiled.properties,
    ...(compiled.required === undefined ? {} : { required: compiled.required }),
  };
}

/**
 * Define a registry-ready tool.
 * @param options - Tool definition in the first-party authoring shape.
 * @returns A definition accepted by `ctx.tools.register`.
 */
export function defineTool(options) {
  const definition = {
    name: options.name,
    description: options.description,
    parameters: parameterSchema(options.parameters),
    output: {
      schema: valueSchema(options.output.schema),
      render: options.output.render,
    },
    async execute(args, exec) {
      return options.execute(args ?? {}, exec);
    },
  };
  if (options.isConcurrencySafe !== undefined) definition.isConcurrencySafe = options.isConcurrencySafe;
  if (options.timeoutMs !== undefined) definition.timeoutMs = options.timeoutMs;
  if (options.deferLoading !== undefined) definition.deferLoading = options.deferLoading;
  return definition;
}
