export type NormalizedPackageJson = {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  type?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  build?: {
    extends?: string | string[] | null;
    productName?: string;
    directories?: { output?: string };
    executableName?: string;
    [key: string]: unknown;
  };
  forge?: unknown;
  exports?: Record<string, unknown>;
  module?: string;
  [key: string]: unknown;
};

export type NormalizedReadResult = {
  packageJson: NormalizedPackageJson;
  path: string;
};

export type ReadPackageUpOptions = {
  cwd?: string | URL;
};
