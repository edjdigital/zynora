<script setup lang="ts">
import Fuse from "fuse.js";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import payload from "../../data/icons.json";

interface IconRecord {
    baseClass: string;
    style: string;
    styleLabel: string;
    slug: string;
    classId: string;
    trademark: boolean;
    htmlUsage: string;
    codepointHex: string | null;
    codepointGlyph: string | null;
    codepointDecimal: number | null;
    previewKind: string;
    previewSvg: string | null;
    relativeSource: string;
}

const allIcons = (payload.icons ?? []) as IconRecord[];

const searchQuery = ref("");
const activeStyle = ref<string>("");
const selected = ref<IconRecord | null>(null);
const copyHint = ref<string>("");

let copyTimer: ReturnType<typeof setTimeout> | null = null;

const styleFilters = computed(() => {
    const map = new Map<string, string>();

    for (const icon of allIcons) {
        if (!map.has(icon.style)) {
            map.set(icon.style, icon.styleLabel);
        }
    }

    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
});

const pool = computed(() => {
    if (!activeStyle.value) {
        return allIcons;
    }

    return allIcons.filter((i) => i.style === activeStyle.value);
});

const fuse = computed(() => {
    return new Fuse(pool.value, {
        keys: [
            {
                name: "slug",
                weight: 0.45
            },
            {
                name: "classId",
                weight: 0.35
            },
            {
                name: "styleLabel",
                weight: 0.12
            },
            {
                name: "style",
                weight: 0.08
            }
        ],
        threshold: 0.32,
        ignoreLocation: true,
        includeScore: true
    });
});

const displayedIcons = computed(() => {
    const q = searchQuery.value.trim();

    if (!q) {
        return pool.value;
    }

    return fuse.value.search(q).map((r) => r.item);
});

function openDetail(icon: IconRecord) {
    selected.value = icon;
    copyHint.value = "";
}

function closeDetail() {
    selected.value = null;
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && selected.value) {
        closeDetail();
    }
}

onMounted(() => {
    window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
    window.removeEventListener("keydown", onKeydown);

    if (copyTimer) {
        clearTimeout(copyTimer);
    }
});

watch(selected, (v) => {
    if (v) {
        document.documentElement.classList.add("zyn-modal-open");
    } else {
        document.documentElement.classList.remove("zyn-modal-open");
    }
});

async function copyText(label: string, text: string) {
    try {
        await navigator.clipboard.writeText(text);
        copyHint.value = label;

        if (copyTimer) {
            clearTimeout(copyTimer);
        }

        copyTimer = setTimeout(() => {
            copyHint.value = "";
        }, 2000);
    } catch {
        copyHint.value = "Copy failed";
    }
}

function classesSnippet(icon: IconRecord) {
    return `${icon.baseClass} ${icon.classId}`;
}

function copyGlyphCharacter(icon: IconRecord) {
    if (icon.codepointDecimal === null || icon.codepointDecimal === undefined) {
        return;
    }

    try {
        const ch = String.fromCodePoint(icon.codepointDecimal);
        copyText("Glyph copied", ch);
    } catch {
        copyHint.value = "Copy failed";

        if (copyTimer) {
            clearTimeout(copyTimer);
        }

        copyTimer = setTimeout(() => {
            copyHint.value = "";
        }, 2000);
    }
}
</script>

<template>
    <div class="zyn-gallery">
        <p v-if="allIcons.length === 0" class="zyn-gallery__empty">
            No icon data yet. Run <code>yarn doc:data</code> in the <code>zynora</code> package, then refresh.
        </p>

        <template v-else>
            <div class="zyn-gallery__toolbar">
                <div class="zyn-gallery__search-wrap">
                    <label class="zyn-sr-only" for="zyn-icon-search">Search icons</label>
                    <input
                        id="zyn-icon-search"
                        v-model="searchQuery"
                        type="search"
                        class="zyn-gallery__search"
                        placeholder="Search by slug, CSS class, or style…"
                        autocomplete="off"
                        spellcheck="false"
                    />
                    <span class="zyn-gallery__count">{{ displayedIcons.length }} icon(s)</span>
                </div>

                <div class="zyn-gallery__filters" role="group" aria-label="Filter by style">
                    <button
                        type="button"
                        class="zyn-chip"
                        :class="{ 'zyn-chip--active': activeStyle === '' }"
                        @click="activeStyle = ''"
                    >
                        All styles
                    </button>
                    <button
                        v-for="[key, label] in styleFilters"
                        :key="key"
                        type="button"
                        class="zyn-chip"
                        :class="{ 'zyn-chip--active': activeStyle === key }"
                        @click="activeStyle = key"
                    >
                        {{ label }}
                    </button>
                </div>
            </div>

            <p v-if="displayedIcons.length === 0" class="zyn-gallery__none">No icons match your search.</p>

            <ul class="zyn-gallery__grid" role="list">
                <li
                    v-for="icon in displayedIcons"
                    :key="icon.style + '/' + icon.slug"
                    class="zyn-card-wrap"
                >
                    <button
                        type="button"
                        class="zyn-card"
                        @click="openDetail(icon)"
                    >
                        <span class="zyn-card__preview" aria-hidden="true">
                            <span
                                v-if="icon.previewKind === 'svg' && icon.previewSvg"
                                class="zyn-card__svg"
                                v-html="icon.previewSvg"
                            />
                            <span v-else class="zyn-card__png">PNG</span>
                        </span>
                        <span class="zyn-card__slug">{{ icon.slug }}</span>
                        <span class="zyn-card__meta">{{ icon.classId }}</span>
                    </button>
                </li>
            </ul>
        </template>

        <Teleport to="body">
            <div
                v-if="selected"
                class="zyn-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="zyn-modal-title"
                @click.self="closeDetail"
            >
                <div class="zyn-modal__panel">
                    <button type="button" class="zyn-modal__close" aria-label="Close" @click="closeDetail">
                        ×
                    </button>

                    <header class="zyn-modal__header">
                        <h2 id="zyn-modal-title" class="zyn-modal__name">{{ selected.slug }}</h2>
                        <div class="zyn-modal__header-meta">
                            <span
                                v-if="selected.codepointGlyph"
                                class="zyn-modal__unicode"
                                title="Private use code point (hex)"
                            >
                                {{ selected.codepointGlyph }}
                            </span>
                            <button
                                v-if="selected.codepointDecimal !== null && selected.codepointDecimal !== undefined"
                                type="button"
                                class="zyn-modal__icon-btn"
                                title="Copy glyph character"
                                aria-label="Copy glyph character"
                                @click="copyGlyphCharacter(selected)"
                            >
                                <span class="zyn-modal__glyph-ico" aria-hidden="true">⎘</span>
                            </button>
                        </div>
                    </header>

                    <div class="zyn-modal__split">
                        <div class="zyn-modal__preview-box">
                            <div class="zyn-modal__preview-inner" aria-hidden="true">
                                <span
                                    v-if="selected.previewKind === 'svg' && selected.previewSvg"
                                    class="zyn-modal__svg"
                                    v-html="selected.previewSvg"
                                />
                                <span v-else class="zyn-modal__png">PNG source</span>
                            </div>
                        </div>
                        <div class="zyn-modal__code-box">
                            <div class="zyn-modal__tabbar" role="tablist">
                                <span class="zyn-modal__tab zyn-modal__tab--active" role="tab" aria-selected="true">HTML</span>
                            </div>
                            <pre class="zyn-modal__code"><code>{{ selected.htmlUsage }}</code></pre>
                            <div class="zyn-modal__actions">
                                <button type="button" class="zyn-btn zyn-btn--ghost" @click="copyText('HTML copied', selected.htmlUsage)">
                                    Copy HTML
                                </button>
                                <button
                                    type="button"
                                    class="zyn-btn zyn-btn--ghost"
                                    @click="copyText('Classes copied', classesSnippet(selected))"
                                >
                                    Copy classes
                                </button>
                            </div>
                            <p v-if="copyHint" class="zyn-modal__hint">{{ copyHint }}</p>
                        </div>
                    </div>

                    <div v-if="selected.trademark" class="zyn-trademark" role="note">
                        <span class="zyn-trademark__icon" aria-hidden="true">i</span>
                        <p class="zyn-trademark__text">
                            <strong>Heads up!</strong> This work may be protected as a trademark. Use only with permission from the
                            rights holder.
                        </p>
                    </div>

                    <footer class="zyn-modal__footer">
                        <span
                            class="zyn-pill"
                            :class="{ 'zyn-pill--brand': selected.style === 'brands' }"
                        >
                            {{ selected.styleLabel.toUpperCase() }}
                        </span>
                        <span v-if="selected.codepointHex" class="zyn-pill zyn-pill--muted">{{ selected.codepointHex }}</span>
                        <code class="zyn-modal__path">icons/{{ selected.style }}/{{ selected.slug }}/</code>
                    </footer>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.zyn-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.zyn-gallery__empty,
.zyn-gallery__none {
    padding: 1.5rem;
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
}

.zyn-gallery__toolbar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.zyn-gallery__search-wrap {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
}

.zyn-gallery__search {
    flex: 1 1 240px;
    min-width: 200px;
    padding: 0.6rem 0.85rem;
    font-size: 1rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: var(--vp-c-bg);
    color: var(--vp-c-text-1);
}

.zyn-gallery__search:focus {
    outline: 2px solid var(--vp-c-brand-1);
    outline-offset: 1px;
}

.zyn-gallery__count {
    font-size: 0.85rem;
    color: var(--vp-c-text-2);
    white-space: nowrap;
}

.zyn-gallery__filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.zyn-chip {
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg);
    color: var(--vp-c-text-2);
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.zyn-chip:hover {
    border-color: var(--vp-c-brand-1);
    color: var(--vp-c-text-1);
}

.zyn-chip--active {
    background: var(--vp-c-brand-1);
    border-color: var(--vp-c-brand-1);
    color: #fff;
}

.zyn-gallery__grid {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--zyn-gallery-gap, 1rem);
}

.zyn-card {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.35rem;
    padding: 1rem 0.65rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 10px;
    background: var(--vp-c-bg-soft);
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
}

.zyn-card:hover {
    border-color: #1e2a5a;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
    transform: translateY(-1px);
}

.zyn-card__preview {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
}

.zyn-card__svg :deep(svg) {
    max-width: 48px;
    max-height: 48px;
}

.zyn-card__png {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--vp-c-text-3);
}

.zyn-card__slug {
    font-size: 1rem;
    font-weight: 700;
    color: var(--vp-c-text-1);
    line-height: 1.2;
    text-transform: lowercase;
    font-family: var(--vp-font-family-base);
}

.zyn-card__meta {
    font-size: 0.72rem;
    color: var(--vp-c-text-3);
    font-family: var(--vp-font-family-mono);
}

.zyn-modal {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
}

.zyn-modal__panel {
    position: relative;
    width: min(880px, 100%);
    margin: auto;
    padding: 1.5rem 1.5rem 1.25rem;
    border-radius: 12px;
    background: var(--vp-c-bg);
    border: 1px solid var(--vp-c-divider);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.zyn-modal__close {
    position: absolute;
    top: 0.65rem;
    right: 0.65rem;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    color: var(--vp-c-text-3);
    z-index: 2;
}

.zyn-modal__close:hover {
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
}

.zyn-modal__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-right: 2.5rem;
    margin-bottom: 1.25rem;
}

.zyn-modal__name {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.25rem);
    font-weight: 800;
    line-height: 1.1;
    text-transform: lowercase;
    letter-spacing: -0.02em;
}

.zyn-modal__header-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
}

.zyn-modal__unicode {
    font-family: var(--vp-font-family-mono);
    font-size: 0.95rem;
    color: var(--vp-c-text-2);
}

.zyn-modal__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 8px;
    background: var(--vp-c-bg-soft);
    cursor: pointer;
    color: var(--vp-c-text-2);
}

.zyn-modal__icon-btn:hover {
    border-color: #1e2a5a;
    color: #1e2a5a;
}

.zyn-modal__glyph-ico {
    font-size: 1.1rem;
    line-height: 1;
}

.zyn-modal__split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
}

@media (max-width: 640px) {
    .zyn-modal__split {
        grid-template-columns: 1fr;
    }
}

.zyn-modal__preview-box {
    min-height: 200px;
}

.zyn-modal__preview-inner {
    height: 100%;
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: #fff;
    border: 1px solid var(--vp-c-divider);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

:root.dark .zyn-modal__preview-inner {
    background: var(--vp-c-bg-soft);
}

.zyn-modal__svg :deep(svg) {
    max-width: 120px;
    max-height: 120px;
    color: #1e2a5a;
}

:root.dark .zyn-modal__svg :deep(svg) {
    color: var(--vp-c-text-1);
}

.zyn-modal__png {
    font-size: 0.85rem;
    color: var(--vp-c-text-3);
}

.zyn-modal__code-box {
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    overflow: hidden;
    background: #1e2a5a;
    color: #e8ecf4;
}

.zyn-modal__tabbar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    padding: 0 0.5rem;
}

.zyn-modal__tab {
    padding: 0.55rem 0.85rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.45);
}

.zyn-modal__tab--active {
    color: #fff;
    border-bottom: 2px solid #f5c400;
    margin-bottom: -1px;
}

.zyn-modal__code {
    margin: 0;
    padding: 1rem 1rem 1.1rem;
    font-size: 0.85rem;
    line-height: 1.5;
    overflow-x: auto;
    flex: 1;
    background: transparent;
}

.zyn-modal__code code {
    font-family: var(--vp-font-family-mono);
    color: #e8ecf4;
}

.zyn-modal__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0 1rem 1rem;
}

.zyn-btn {
    padding: 0.45rem 0.85rem;
    font-size: 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
}

.zyn-btn--ghost {
    border: 1px solid rgba(255, 255, 255, 0.35);
    background: transparent;
    color: #fff;
}

.zyn-btn--ghost:hover {
    background: rgba(255, 255, 255, 0.1);
}

.zyn-modal__hint {
    margin: 0 1rem 0.75rem;
    font-size: 0.78rem;
    color: #f5c400;
}

.zyn-trademark {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.85rem 1rem;
    margin-bottom: 1rem;
    border-radius: 8px;
    border: 1px solid var(--vp-c-divider);
    background: var(--vp-c-bg-soft);
}

.zyn-trademark__icon {
    flex-shrink: 0;
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 50%;
    background: var(--vp-c-brand-1);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 800;
    font-style: italic;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.zyn-trademark__text {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.45;
    color: var(--vp-c-text-2);
}

.zyn-modal__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
}

.zyn-pill {
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-2);
    border: 1px solid var(--vp-c-divider);
}

.zyn-pill--brand {
    background: #f5c400;
    color: #1a1a1a;
    border-color: #e0b000;
}

.zyn-pill--muted {
    font-family: var(--vp-font-family-mono);
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    font-size: 0.7rem;
}

.zyn-modal__path {
    margin-left: auto;
    font-size: 0.72rem;
    color: var(--vp-c-text-3);
}
</style>
