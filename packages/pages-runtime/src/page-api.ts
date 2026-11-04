export interface PageMetadata {
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly order?: number;
  readonly author?: string;
  readonly labels?: readonly string[];
  readonly source?: string;
}

export interface PageDocument extends PageMetadata {
  readonly yaml: string;
}

export class PageApiClient {
  readonly #appId: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #baseUrl: string;
  readonly #tokenFn?: () => string | undefined;

  constructor(appId: string, fetchFn?: typeof globalThis.fetch, baseUrl?: string, tokenFn?: () => string | undefined) {
    this.#appId = encodeURIComponent(appId);
    this.#fetch = fetchFn ?? globalThis.fetch.bind(globalThis);
    this.#baseUrl = baseUrl ?? "";
    this.#tokenFn = tokenFn;
  }

  async list(labelFilter?: string): Promise<PageMetadata[]> {
    const params = labelFilter ? `?label=${encodeURIComponent(labelFilter)}` : "";
    const res = await this.#fetch(`${this.#baseUrl}/api/apps/${this.#appId}/pages${params}`, {
      headers: this.#headers(),
    });
    if (!res.ok) throw new Error(await this.#errorMessage(res));
    return res.json();
  }

  async get(name: string): Promise<PageDocument> {
    const res = await this.#fetch(`${this.#baseUrl}/api/apps/${this.#appId}/pages/${encodeURIComponent(name)}`, {
      headers: this.#headers(),
    });
    if (!res.ok) throw new Error(await this.#errorMessage(res));
    return res.json();
  }

  async create(page: { name: string; yaml: string; description?: string; icon?: string; order?: number; labels?: string[] }): Promise<PageDocument> {
    const res = await this.#fetch(`${this.#baseUrl}/api/apps/${this.#appId}/pages`, {
      method: "POST",
      headers: { ...this.#headers(), "Content-Type": "application/json" },
      body: JSON.stringify(page),
    });
    if (!res.ok) throw new Error(await this.#errorMessage(res));
    return res.json();
  }

  async update(name: string, changes: Partial<PageDocument>, etag?: string): Promise<PageDocument> {
    const headers: Record<string, string> = { ...this.#headers(), "Content-Type": "application/json" };
    if (etag) headers["If-Match"] = etag;
    const res = await this.#fetch(`${this.#baseUrl}/api/apps/${this.#appId}/pages/${encodeURIComponent(name)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(changes),
    });
    if (!res.ok) throw new Error(await this.#errorMessage(res));
    return res.json();
  }

  async delete(name: string): Promise<void> {
    const res = await this.#fetch(`${this.#baseUrl}/api/apps/${this.#appId}/pages/${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: this.#headers(),
    });
    if (!res.ok) throw new Error(await this.#errorMessage(res));
  }

  #headers(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = this.#tokenFn?.();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async #errorMessage(res: Response): Promise<string> {
    try {
      const body = await res.json() as { error?: string };
      return body.error ?? `HTTP ${String(res.status)}`;
    } catch {
      return `HTTP ${String(res.status)}`;
    }
  }
}
