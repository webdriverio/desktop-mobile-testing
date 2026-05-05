export function mockLookupExpr(mockName: string): string {
  return `window.__wdio_mocks__?.[${JSON.stringify(mockName)}]`;
}

export function errorReconstructExpr(varName: string): string {
  return `(${varName} && typeof ${varName} === 'object' && ${varName}.__wdioError === true ? new Error(${varName}.message) : ${varName})`;
}
