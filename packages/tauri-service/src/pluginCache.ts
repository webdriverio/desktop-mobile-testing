const pluginAvailabilityCache = new WeakMap<WebdriverIO.Browser, boolean>();

export function isPluginAvailabilityCached(browser: WebdriverIO.Browser): boolean {
  return pluginAvailabilityCache.get(browser) === true;
}

export function setPluginAvailabilityCached(browser: WebdriverIO.Browser): void {
  pluginAvailabilityCache.set(browser, true);
}

export function clearPluginAvailabilityCache(browser: WebdriverIO.Browser): void {
  pluginAvailabilityCache.delete(browser);
}
