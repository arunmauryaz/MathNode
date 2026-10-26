# Authoring MathNode nodes

MathNode uses portable UTF-8 JSON `.mnode` files. Prefer a prefab assembled from existing nodes when possible. Code kernels are for operations the library cannot express cleanly. The bundled standard library contains 93 additional nodes; its editable source is `src/utils/standardLibrary.ts`, numerical helpers are in `src/utils/mathLibrary.ts`, and portable copies are in `library/standard/`.

## Quick SDK workflow

From the repository directory, with Node.js 22.3 or later (npm 10.5+) and `npm install` completed:

```sh
npm run sdk -- scaffold square-plus-one.mnode
npm run sdk -- validate square-plus-one.mnode
npm run sdk -- run square-plus-one.mnode '{"x":3}'
npm run sdk -- run square-plus-one.mnode '{"x":"A"}'
npm run library:test
npm run library:export
```

PowerShell users can put JSON in a file and use the MCP library tools, or use their shell's native argument quoting. The CLI accepts JSON as its final argument. `scaffold` never overwrites an existing file. `validate` accepts a file or directory and executes no code. `run` executes one trusted kernel in a worker with a three-second deadline. Workers are an execution boundary, **not a security sandbox**: Node.js kernels can access the local machine. Inspect code before running third-party nodes.

The TypeScript SDK entry is `sdk/index.ts`: `defineNode`, `validateNode`, `runExample`, the graph parser, connection rules, composite builders, and bundled definitions. CLI commands bundle it automatically; no build step is needed.

## Format

```json
{
  "id": "custom.square-plus-one",
  "name": "Square Plus One",
  "description": "Compute x² + 1 for numeric or symbolic values.",
  "category": "Custom",
  "inputs": [{"name":"x","type":"scalar","default":2,"widget":"number"}],
  "outputs": [{"name":"result","type":"scalar"}],
  "code": "(inputs, math) => ({ result: math.operate('+', math.operate('^', inputs.x, 2), 1) })"
}
```

IDs must be stable and unique. Use your own prefix; `math.*` and `standard.*` bundled IDs are reserved by the MCP installer. Input and output names must be unique within each list and match keys used by kernels. Return an object containing every declared output. No missing outputs, infinities, NaNs, or wrong socket types are accepted. Synchronous expression functions and function bodies are supported. Asynchronous kernels are not supported.

Types: `scalar`, `int`, `vector`, `matrix`, `bool`, `string`, `equation`, `calculus`, `any`. Scalars can be finite numbers or structured symbolic expressions. Integer ports require finite integers. Vectors and matrices are numeric arrays. Use `any` deliberately; typed connections catch errors earlier.

Widgets: `number`, `slider`, `text`, `dropdown`, `toggle`, `matrix2x2`, `matrix4x4`. Scalar number fields accept numbers, symbols, and LaTeX. Dropdowns require nonempty string `options`. Optional socket properties: `label`, `description`, `default`, `min`, `max`, `step`, `connectable:false` for local settings, `enabledWhen` for a toggle-controlled setting. Changing settings triggers evaluation just like changing an input.

## Math kernel helpers

`math` inherits JavaScript `Math`, with these additions:

| Helper | Purpose |
|---|---|
| `math.value(textOrNumber, optionalBinding)` | Number, symbol, or scalar LaTeX source |
| `math.operate('+', a, b)` | Symbol-aware `+`, `-`, `*`, `/`, `^`, `%` |
| `math.applyFunction('sqrt(x)', a)` | Existing elementary function adapter |
| `math.call('Sin', a)` | Compute-engine symbolic functions; built-in nodes demonstrate supported operators |
| `math.equation(left, right)` | Build a mathematical equality |
| `math.latexEquation('y=x^2')` | Parse one LaTeX equality |
| `math.substitute(expression, 'A=2, B=3')` | Bind finite numbers while preserving the formula |
| `math.transform(expression, 'Expand')` | `Simplify`, `Expand`, or `Factor` |
| `math.derivative(expression, 'x')` | Symbolic derivative |
| `math.integral(expression, 'x', optionalLower, optionalUpper)` | Indefinite/definite integration |
| `math.series(expression, 'n', lower, upper, product=false)` | Bounded integer sum/product, at most 1001 terms |
| `math.numeric(value)` | Require an assigned finite real result; throws if unresolved |
| `math.numericValue(value)` | Return a number or `undefined` for unbound expressions |
| `math.toLatex(value)` | Export mathematical notation |
| `math.collections.*` | Validated numeric datasets, statistics, vectors, matrices, combinatorics |

Never use JavaScript `+` or `Number()` on a symbolic scalar. Use `operate`, `call`, and `numeric`. Domain failures should throw a specific actionable error. The canvas highlights the actual failed node red and blocked dependents amber. All assignments are local to expressions; there is no shared global variable table. The internal `variable()` helper remains for compatibility, but there is **no separate Variable node**.

Value examples: `2.5`, `A`, `A^2+B^2+2AB`, `\frac{A}{B}`, `\sqrt{x}`, `\sum_{n=1}^{5}n`. Standard LaTeX multiplication is juxtaposition or `\cdot`; common function input such as `sqrt(9)` is also accepted. `pi` and `e` are constants. Multi-letter plain identifiers represent a named variable; use explicit multiplication to avoid ambiguity. Equations belong in Equation/LaTeX Equation nodes. Parsing does not implement arbitrary TeX documents, macros, assignments, or executable JavaScript.

Numerical results use real machine precision. The algebra engine supports many common expressions; unresolved special functions, integrals and equations can remain symbolic. Indefinite integrals omit the arbitrary integration constant. Equation nodes represent equalities and are not general equation solvers.

## Prefabs and sharing

Select at least two connected nodes, including Value inputs and an Output sink (or valid boundary ports), then Make Node. Each Value becomes an exposed scalar input. Defaults can be symbols: your friend replaces `A` and `B` with numerical values, or connects numeric Value nodes. The internal graph and nested definitions are embedded in the `.mnode` export. There must be an input-to-output path for every selected node, no unused inputs, and no cycles.

Use `examples/symbolic_whole_square.mnode` to try `(A+B)^2`. Its defaults are `A` and `B`; using 2 and 3 produces 25. Open Contents inspects the internal graph. MCP also supports inspecting and unpacking prefab instances for editing.

## Required verification for a new node

1. Validate the schema and inspect the declared port types.
2. Execute a known numeric example with an independently computed expected answer.
3. Try symbolic inputs if the node advertises them, then substitute known numerical values.
4. Exercise domain/shape errors (zero divisors, negative roots, singular matrices, dimension mismatch).
5. Export/import and execute again for composites.

`STANDARD_EXAMPLES` is the executable example catalog. Add a fixture when extending the standard library. `npm test` verifies the graph engine and real browser interactions. The SDK fixture suite runs each standard node in a separate worker.

Parser: [Compute Engine](https://cortexjs.io/compute-engine/). Typesetting: [KaTeX](https://katex.org/docs/api). Keep KaTeX `trust:false` and bounded expansion. Do not execute kernels in hover previews.
