// @ts-check

const MANIFEST_KEY = "manifest";
const SUMMARIES_KEY = "summaries";
const REVALIDATION_QUIET_MS = 1000;

/** @param {string} name */
function announce(name) {
  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    globalThis.dispatchEvent(new CustomEvent(name));
  }
}

/**
 * Public stale-while-revalidate repository shared by API and fixture providers.
 * @param {import('./contract.js').ExperienceRepository} provider
 * @param {ReturnType<import('../../data/mygita-data-cache.js').createMyGitaDataCache>} cache
 * @param {{now?:()=>number}} [options]
 */
export function createCachedExperienceRepository(provider, cache, { now = Date.now } = {}) {
  let refreshState = "idle";
  let lastError = null;
  let lastCheckedAt = 0;

  async function refreshManifest(signal) {
    const cached = await cache.public.catalogue.read(MANIFEST_KEY);
    const previous = /** @type {{manifest:import('./models.js').ExperienceCatalogueManifest,etag:string|null}|undefined} */ (cached?.data);
    const response = await provider.revalidateCatalogueManifest({ signal, etag: previous?.etag || undefined });
    if (response.status === 304 && previous) return { manifest: previous.manifest, changed: false };
    if (response.status !== 200 || !response.data) throw new Error("The Experience catalogue manifest could not be refreshed.");
    const etag = response.etag || response.data.catalogueVersion;
    await cache.public.catalogue.write(MANIFEST_KEY, {
      recordVersion: etag,
      data: { manifest: response.data, etag: response.etag },
    });
    return { manifest: response.data, changed: previous?.manifest.catalogueVersion !== response.data.catalogueVersion };
  }

  async function refreshSummaries(signal) {
    const { manifest, changed: manifestChanged } = await refreshManifest(signal);
    const existing = await cache.public.catalogue.read(SUMMARIES_KEY, { version: manifest.catalogueVersion });
    if (existing) return { items: /** @type {import('./models.js').ExperienceCardSummary[]} */ (existing.data), changed: manifestChanged };
    const response = await provider.listExperienceSummaries({ signal });
    await cache.public.catalogue.write(SUMMARIES_KEY, {
      recordVersion: response.catalogueVersion,
      data: response.items,
    });
    return { items: response.items, changed: true };
  }

  function startBackgroundRefresh(signal) {
    refreshState = "refreshing";
    lastError = null;
    void refreshSummaries(signal).then(({ changed }) => {
      refreshState = "idle";
      lastCheckedAt = now();
      if (changed) announce("mygita:experience-cache-updated");
      else announce("mygita:experience-cache-checked");
    }).catch((error) => {
      if (signal?.aborted) return;
      refreshState = "error";
      lastError = error;
      lastCheckedAt = now();
      announce("mygita:experience-cache-checked");
    });
  }

  return Object.freeze({
    ...provider,
    getPublicRefreshState() { return { state: refreshState, error: lastError }; },
    async listExperienceSummaries(options={}) {
      const cached = await cache.public.catalogue.read(SUMMARIES_KEY);
      if (cached) {
        if (now() - lastCheckedAt > REVALIDATION_QUIET_MS && refreshState !== "refreshing") startBackgroundRefresh(options.signal);
        return { catalogueVersion: cached.recordVersion, items: /** @type {import('./models.js').ExperienceCardSummary[]} */ (cached.data) };
      }
      refreshState = "refreshing";
      try {
        const result = await refreshSummaries(options.signal);
        refreshState = "idle";
        lastCheckedAt = now();
        return { catalogueVersion: (await cache.public.catalogue.read(SUMMARIES_KEY))?.recordVersion || "unknown", items: result.items };
      } catch (error) {
        refreshState = "error";
        lastError = error;
        throw error;
      }
    },
    async getExperience(slug, options={}) {
      const { manifest } = await refreshManifest(options.signal);
      const reference = manifest.experiences.find((item) => item.slug === slug);
      if (!reference) return undefined;
      const cached = await cache.public.experienceDetails.read(slug, { version: reference.detailVersion });
      if (cached) return /** @type {import('./models.js').Experience} */ (cached.data);
      const item = await provider.getExperience(slug, options);
      if (item) await cache.public.experienceDetails.write(slug, { recordVersion: reference.detailVersion, data: item });
      return item;
    },
  });
}
