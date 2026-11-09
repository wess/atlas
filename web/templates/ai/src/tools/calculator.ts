import { tool } from "@wess/atlas/ai"
import type { AgentTool } from "@wess/atlas/ai"

// The expression comes from the model, and the model can be steered by any document or message
// it reads. Never hand it to eval or new Function: that runs it as code on this server. This is a
// small arithmetic parser instead: numbers, + - * / % ^, parentheses, and unary minus. Anything
// else is rejected.

const maxLength = 200

const tokenize = (text: string): string[] => {
  const tokens = text.match(/\d+(?:\.\d+)?|\.\d+|[-+*/%^()]|\S/g) ?? []
  const bad = tokens.find((t) => !/^(?:\d+(?:\.\d+)?|\.\d+|[-+*/%^()])$/.test(t))
  if (bad) throw new Error(`unexpected character "${bad}"`)
  return tokens
}

// Grammar, lowest precedence first:
//   sum     = product (("+" | "-") product)*
//   product = unary (("*" | "/" | "%") unary)*
//   unary   = "-" unary | "+" unary | power
//   power   = atom ("^" unary)?          right-associative, so 2^3^2 = 2^9
//   atom    = number | "(" sum ")"
export const evaluate = (expression: string): number => {
  if (expression.length > maxLength) throw new Error(`expression is longer than ${maxLength} characters`)

  const tokens = tokenize(expression)
  let position = 0
  const peek = () => tokens[position]
  const next = () => tokens[position++]

  const atom = (): number => {
    const token = next()
    if (token === "(") {
      const value = sum()
      if (next() !== ")") throw new Error("missing )")
      return value
    }
    if (token !== undefined && /^[\d.]/.test(token)) return Number(token)
    throw new Error(token === undefined ? "unexpected end of expression" : `unexpected "${token}"`)
  }

  const power = (): number => {
    const base = atom()
    if (peek() !== "^") return base
    next()
    return base ** unary()
  }

  const unary = (): number => {
    if (peek() === "-") {
      next()
      return -unary()
    }
    if (peek() === "+") {
      next()
      return unary()
    }
    return power()
  }

  const product = (): number => {
    let value = unary()
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next()
      const right = unary()
      value = op === "*" ? value * right : op === "/" ? value / right : value % right
    }
    return value
  }

  const sum = (): number => {
    let value = product()
    while (peek() === "+" || peek() === "-") {
      const op = next()
      const right = product()
      value = op === "+" ? value + right : value - right
    }
    return value
  }

  const result = sum()
  if (position < tokens.length) throw new Error(`unexpected "${peek()}"`)
  if (!Number.isFinite(result)) throw new Error("result is not a finite number")
  return result
}

export const calculatorTool: AgentTool = {
  definition: tool("calculate", "Evaluate an arithmetic expression: numbers, + - * / % ^ and parentheses", {
    type: "object",
    properties: { expression: { type: "string", description: "Arithmetic expression, e.g. (42 * 17) / 3" } },
    required: ["expression"],
  }),
  handler: async (args: Record<string, unknown>) => {
    if (typeof args.expression !== "string") return "Error: expression must be a string"
    try {
      return String(evaluate(args.expression))
    } catch (err) {
      return `Error: ${(err as Error).message}`
    }
  },
}
