export class DirectEvalClient {
  constructor(
    private readonly port: number,
    private readonly defaultTimeoutMs = 30_000,
  ) {}

  async eval(
    wrappedScript: string,
    opts: {
      args?: unknown[];
      windowLabel?: string;
      timeoutMs?: number;
    } = {},
  ): Promise<unknown> {
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
    const url = `http://127.0.0.1:${this.port}/wdio/eval`;

    const body: Record<string, unknown> = {
      script: wrappedScript,
      args: opts.args ?? [],
      timeout_ms: timeoutMs,
    };
    if (opts.windowLabel !== undefined) {
      body.window_label = opts.windowLabel;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs + 5_000),
    });

    if (!response.ok) {
      throw new Error(`Direct eval HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { value?: unknown; error?: string; undef?: boolean };

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.undef === true) {
      return undefined;
    }

    return data.value;
  }
}
