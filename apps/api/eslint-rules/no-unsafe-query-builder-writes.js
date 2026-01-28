/**
 * ESLint rule to warn about query builder writes without explicit RLS transaction.
 *
 * This rule detects patterns like:
 *   Model.query().update({...})  // WARN: No explicit transaction
 *   Model.query().delete()       // WARN: No explicit transaction
 *
 * And encourages:
 *   Model.query({ client: trx }).update({...})  // OK: Explicit transaction
 *   Model.query({ client: ctx.tenantDb }).delete()  // OK: Explicit RLS context
 *
 * WHY THIS MATTERS:
 * -----------------
 * Our BaseModel hooks only cover find/fetch operations. Query builder .update()
 * and .delete() bypass the automatic RLS binding, potentially executing without
 * proper tenant/user context.
 *
 * This rule helps catch these issues at lint time rather than runtime.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Warn when query builder .update() or .delete() is called without explicit transaction client',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      missingClient:
        'Query builder .{{method}}() may bypass RLS. Pass { client: trx } to .query() or use instance methods instead.',
      preferInstanceMethod:
        'Consider using instance methods (fetch rows, modify, save/delete) for RLS-aware operations.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          severity: {
            type: 'string',
            enum: ['warn', 'error'],
            default: 'warn',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    /**
     * Check if a CallExpression has a client option in its arguments.
     * Looks for patterns like: .query({ client: ... })
     */
    function hasClientOption(node) {
      // Walk up to find the .query() call
      let current = node

      while (current && current.parent) {
        // Look for CallExpression with callee being MemberExpression with property 'query'
        if (
          current.type === 'CallExpression' &&
          current.callee &&
          current.callee.type === 'MemberExpression' &&
          current.callee.property &&
          current.callee.property.name === 'query'
        ) {
          // Check if there's an argument that's an object with 'client' property
          const args = current.arguments || []
          for (const arg of args) {
            if (arg.type === 'ObjectExpression') {
              for (const prop of arg.properties || []) {
                if (
                  prop.type === 'Property' &&
                  prop.key &&
                  (prop.key.name === 'client' || prop.key.value === 'client')
                ) {
                  return true
                }
              }
            }
          }
          return false
        }

        // Move up the chain (MemberExpression -> CallExpression -> etc.)
        if (current.type === 'MemberExpression') {
          current = current.object
        } else if (current.type === 'CallExpression') {
          current = current.callee
        } else {
          break
        }
      }

      return false
    }

    /**
     * Check if we're inside a chain that starts with a Model.query() call.
     * We want to detect: Model.query().where(...).update(...)
     * But not: trx.from('table').update(...)
     */
    function isModelQueryChain(node) {
      let current = node

      while (current) {
        // Look for .query() call
        if (
          current.type === 'CallExpression' &&
          current.callee &&
          current.callee.type === 'MemberExpression' &&
          current.callee.property &&
          current.callee.property.name === 'query'
        ) {
          // Check if the object is a PascalCase identifier (likely a Model)
          const obj = current.callee.object
          if (obj && obj.type === 'Identifier') {
            // Model names are typically PascalCase
            const name = obj.name
            if (name && name[0] === name[0].toUpperCase() && name[0] !== name[0].toLowerCase()) {
              return true
            }
          }
          return false
        }

        // Move up the chain
        if (current.type === 'MemberExpression') {
          current = current.object
        } else if (current.type === 'CallExpression') {
          current = current.callee
        } else {
          break
        }
      }

      return false
    }

    return {
      // Match: .update(...) or .delete(...) calls
      'CallExpression[callee.property.name=/^(update|delete)$/]'(node) {
        const methodName = node.callee.property.name

        // Only check if this looks like a Model.query() chain
        if (!isModelQueryChain(node.callee.object)) {
          return
        }

        // Check if the chain includes { client: ... }
        if (hasClientOption(node.callee.object)) {
          return
        }

        // Report the issue
        context.report({
          node,
          messageId: 'missingClient',
          data: {
            method: methodName,
          },
        })
      },
    }
  },
}
