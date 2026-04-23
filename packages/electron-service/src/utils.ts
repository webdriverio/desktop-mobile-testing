import type { ExecuteOpts } from '@wdio/native-types';

export function isInternalCommand(args: unknown[]): boolean {
  return Boolean((args[args.length - 1] as ExecuteOpts | undefined)?.internal);
}

export function hasSemicolonOutsideQuotes(s: string): boolean {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && (inSingle || inDouble || inTemplate)) {
      i++;
      continue;
    }
    if (c === "'" && !inDouble && !inTemplate) {
      inSingle = !inSingle;
      continue;
    }
    if (c === '"' && !inSingle && !inTemplate) {
      inDouble = !inDouble;
      continue;
    }
    if (c === '`' && !inSingle && !inDouble) {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ';' && depth === 0) return true;
  }
  return false;
}

export function hasTopLevelArrow(s: string): boolean {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && (inSingle || inDouble || inTemplate)) {
      i++;
      continue;
    }
    if (c === "'" && !inDouble && !inTemplate) {
      inSingle = !inSingle;
      continue;
    }
    if (c === '"' && !inSingle && !inTemplate) {
      inDouble = !inDouble;
      continue;
    }
    if (c === '`' && !inSingle && !inDouble) {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === '=' && depth === 0 && i + 1 < s.length && s[i + 1] === '>') return true;
  }
  return false;
}
