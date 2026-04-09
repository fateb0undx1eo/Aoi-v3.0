const PATH_TOKEN = /^[a-zA-Z0-9_.]+$/;
const SAFE_MATH = /^[\d+\-*/().\s]+$/;

function getPathValue(object, path) {
  if (!PATH_TOKEN.test(path)) return '';
  return path.split('.').reduce((acc, part) => (acc == null ? '' : acc[part]), object);
}

function stringifyValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function safeCalc(expr) {
  if (!SAFE_MATH.test(expr)) return '';
  try {
    const result = Function(`"use strict"; return (${expr});`)();
    return Number.isFinite(result) ? String(result) : '';
  } catch {
    return '';
  }
}

function evalCondition(expression, context) {
  const includesMatch = expression.match(/^([a-zA-Z0-9_.]+)\s+includes\s+"([^"]+)"$/);
  if (includesMatch) {
    const value = getPathValue(context, includesMatch[1]);
    const expected = includesMatch[2];
    if (Array.isArray(value)) return value.includes(expected);
    return String(value).includes(expected);
  }

  const equalsMatch = expression.match(/^([a-zA-Z0-9_.]+)\s*==\s*"([^"]+)"$/);
  if (equalsMatch) {
    const value = getPathValue(context, equalsMatch[1]);
    return String(value) === equalsMatch[2];
  }

  return Boolean(getPathValue(context, expression.trim()));
}

export class PlaceholderEngine {
  render(input, context = {}) {
    if (!input || typeof input !== 'string') return '';
    const withConditionals = this._renderConditionals(input, context);
    return this._renderTokens(withConditionals, context);
  }

  _renderConditionals(input, context) {
    const conditionalPattern = /\{if ([^}]+)\}([\s\S]*?)\{\/if\}/g;
    return input.replace(conditionalPattern, (_, condition, content) =>
      evalCondition(condition.trim(), context) ? this.render(content, context) : ''
    );
  }

  _renderTokens(input, context) {
    return input.replace(/\{([^}]+)\}/g, (_, token) => {
      const trimmed = token.trim();
      if (trimmed.includes(':')) {
        return this._renderFunction(trimmed, context);
      }

      const value = getPathValue(context, trimmed);
      return stringifyValue(value);
    });
  }

  _renderFunction(token, context) {
    const [name, ...args] = token.split(':');
    const argRaw = args.join(':');

    switch (name) {
      case 'upper':
        return argRaw.toUpperCase();
      case 'lower':
        return argRaw.toLowerCase();
      case 'random': {
        const options = argRaw.split('|').filter(Boolean);
        if (options.length === 0) return '';
        const index = Math.floor(Math.random() * options.length);
        return options[index];
      }
      case 'calc':
        return safeCalc(argRaw);
      case 'time': {
        try {
          return new Intl.DateTimeFormat('en-US', {
            timeZone: argRaw,
            dateStyle: 'medium',
            timeStyle: 'medium'
          }).format(new Date());
        } catch {
          return '';
        }
      }
      case 'mention': {
        const id = argRaw.trim();
        if (!/^\d+$/.test(id)) return '';
        return `<@${id}>`;
      }
      default: {
        const contextValue = getPathValue(context, token);
        return stringifyValue(contextValue);
      }
    }
  }
}
