"use client";

import {
  ArrowRight,
  CircleNotch,
  Compass,
  GlobeHemisphereWest,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react";
import { FormEvent, useMemo, useState } from "react";

import {
  defaultReadingLanguage,
  getReadingLanguageByEdition,
  readingLanguages,
} from "@/lib/languages";
import { cn } from "@/lib/utils";
import type { SearchMode, SearchResponse, SourceAyah } from "@/lib/types";

const prompts = [
  "I feel anxious",
  "Patience during hardship",
  "Parents and gratitude",
  "Forgiveness",
  "13:28",
];

export function QuranLensApp() {
  const [query, setQuery] = useState("");
  const mode: SearchMode = "quran";
  const [selectedEdition, setSelectedEdition] = useState(defaultReadingLanguage.edition);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const readingLanguage = useMemo(
    () => getReadingLanguageByEdition(selectedEdition),
    [selectedEdition],
  );

  async function runSearch(nextQuery = query, nextEdition = selectedEdition) {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      setError("Type a question or choose one of the examples.");
      return;
    }

    const activeLanguage = getReadingLanguageByEdition(nextEdition);
    setIsLoading(true);
    setError("");
    setQuery(trimmed);
    setSelectedEdition(activeLanguage.edition);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          mode,
          preferredEdition: activeLanguage.edition,
        }),
      });

      if (!response.ok) {
        throw new Error("Search request failed.");
      }

      setResult((await response.json()) as SearchResponse);
    } catch (searchError) {
      console.error(searchError);
      setError("I could not complete that search. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch();
  }

  function onLanguageChange(nextEdition: string) {
    setSelectedEdition(nextEdition);
    if (result && query.trim()) {
      void runSearch(query, nextEdition);
    }
  }

  const visibleSources = result?.sources ?? [];

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f7f3ea] text-[#211f1a]">
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:linear-gradient(90deg,#1f3b32_1px,transparent_1px),linear-gradient(#1f3b32_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_74%_10%,rgba(169,132,64,0.16),transparent_30%),radial-gradient(circle_at_8%_42%,rgba(34,95,77,0.12),transparent_28%)]" />

      <section className="relative mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)] lg:px-8">
        <aside className="rounded-[28px] border border-[#2c453b]/10 bg-[#fffbf2]/80 p-4 shadow-[0_24px_80px_-48px_rgba(48,43,32,0.55)] backdrop-blur-xl sm:p-5 lg:sticky lg:top-5 lg:h-[calc(100dvh-40px)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#6e725f]">
                Ask. Read. Check.
              </p>
              <h1 className="mt-3 max-w-[14ch] text-4xl font-semibold leading-[0.95] tracking-tight text-[#1c241e] sm:text-5xl">
                Quran Lens
              </h1>
            </div>
            <div className="grid size-12 place-items-center rounded-2xl border border-[#24493e]/15 bg-[#21483d] text-[#fff8e7] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <Compass size={23} weight="duotone" />
            </div>
          </div>

          <p className="mt-5 max-w-[39ch] text-sm leading-6 text-[#5d5b50]">
            Ask in your own words. Quran Lens finds relevant verses, gives a short answer, and keeps the citations visible.
          </p>

          <div className="mt-5 rounded-3xl border border-[#263f35]/10 bg-white/55 p-3">
            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-[#2d332d]">
                <GlobeHemisphereWest size={18} weight="duotone" />
                Reading language
              </span>
              <select
                value={selectedEdition}
                onChange={(event) => onLanguageChange(event.target.value)}
                className="h-11 w-full rounded-2xl border border-[#263f35]/12 bg-[#fffdf7] px-3 text-sm font-semibold text-[#242b24] outline-none transition focus:border-[#2f6656]/35 focus:shadow-[0_0_0_4px_rgba(47,102,86,0.09)]"
              >
                {readingLanguages.map((language) => (
                  <option key={language.edition} value={language.edition}>
                    {language.nativeLabel} / {language.label}
                  </option>
                ))}
              </select>
              <span className="block text-xs leading-5 text-[#777265]">
                Answers and verse text use {readingLanguage.sourceLabel} when it is loaded.
              </span>
            </label>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#2d332d]">
                What are you looking for?
              </span>
              <div className="relative">
                <MagnifyingGlass
                  className="pointer-events-none absolute left-4 top-4 text-[#75806f]"
                  size={19}
                />
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-3xl border border-[#263f35]/12 bg-white/78 py-4 pl-12 pr-4 text-[15px] leading-6 text-[#21251f] outline-none transition focus:border-[#2f6656]/35 focus:bg-white focus:shadow-[0_0_0_4px_rgba(47,102,86,0.09)]"
                  placeholder="Example: I feel anxious, what should I reflect on?"
                />
              </div>
              {error ? (
                <span className="block rounded-2xl border border-[#9b3d32]/18 bg-[#fff3ef] px-3 py-2 text-xs leading-5 text-[#8a342a]">
                  {error}
                </span>
              ) : null}
              <span className="block text-xs leading-5 text-[#777265]">
                No special wording needed. You can ask about a feeling, topic, Arabic word, or verse number.
              </span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="group flex h-13 w-full items-center justify-between rounded-2xl bg-[#b98b3d] px-5 text-sm font-semibold text-[#20170a] shadow-[0_16px_40px_-24px_rgba(72,43,10,0.9)] transition hover:bg-[#c79b4c] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span>{isLoading ? "Finding verses" : "Find relevant verses"}</span>
              {isLoading ? (
                <CircleNotch className="animate-spin" size={19} />
              ) : (
                <ArrowRight className="transition group-hover:translate-x-0.5" size={19} />
              )}
            </button>
          </form>

          <div className="mt-6 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7c7663]">
              Start with one
            </p>
            <div className="flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void runSearch(prompt)}
                  className="rounded-full border border-[#263f35]/12 bg-white/58 px-3 py-2 text-left text-xs font-medium text-[#514f46] transition hover:border-[#2f6656]/25 hover:bg-white active:scale-[0.98]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 rounded-3xl border border-[#24493e]/10 bg-[#233d35] p-4 text-[#f8f0df]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkle size={18} weight="duotone" />
              Important
            </div>
            <p className="mt-3 text-xs leading-5 text-[#d8cfbc]">
              This is for learning and reflection. For rulings or personal religious decisions, ask a qualified scholar.
            </p>
          </div>
        </aside>

        <section className="space-y-5">
          <AnswerPanel
            result={result}
            isLoading={isLoading}
            error={result ? error : ""}
            sources={visibleSources}
            readingLanguage={readingLanguage.nativeLabel}
          />

          <div className="rounded-[28px] border border-[#263f35]/10 bg-[#fffaf0]/76 p-4 shadow-[0_24px_70px_-54px_rgba(52,48,40,0.65)] backdrop-blur-xl sm:p-5">
            <div className="flex flex-col justify-between gap-3 border-b border-[#263f35]/10 pb-4 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7a7564]">
                  Verses
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Verses behind the answer
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[#686458]">
                Read the verses directly. Tap a verse reference to search that verse on its own.
              </p>
            </div>

            {isLoading ? (
              <SourceSkeleton />
            ) : visibleSources.length > 0 ? (
              <div className="mt-5 grid gap-4">
                {visibleSources.map((source, index) => (
                  <SourceCard
                    key={source.ayahId}
                    source={source}
                    index={index}
                    onSearch={runSearch}
                  />
                ))}
              </div>
            ) : (
              <EmptyState onSearch={() => void runSearch("patience and prayer")} />
            )}
          </div>

          {result ? (
            <ConceptPanel result={result} onSearch={runSearch} />
          ) : (
            <HowItWorksPanel />
          )}
        </section>
      </section>
    </main>
  );
}

function AnswerPanel({
  result,
  isLoading,
  error,
  sources,
  readingLanguage,
}: {
  result: SearchResponse | null;
  isLoading: boolean;
  error: string;
  sources: SourceAyah[];
  readingLanguage: string;
}) {
  return (
    <div className="min-h-[320px] rounded-[28px] border border-[#263f35]/10 bg-[#fffaf0]/82 p-5 shadow-[0_28px_80px_-52px_rgba(52,48,40,0.65)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {result ? (
          <>
            <span className="rounded-full border border-[#204a3d]/15 bg-[#204a3d] px-3 py-1.5 text-xs font-medium text-[#fff8e7]">
              Your question
            </span>
            <span className="max-w-full rounded-full border border-[#263f35]/10 bg-white/65 px-3 py-1.5 text-xs font-medium text-[#5d5a50]">
              {result.query}
            </span>
          </>
        ) : (
          <>
            <span className="rounded-full border border-[#204a3d]/15 bg-[#204a3d] px-3 py-1.5 text-xs font-medium text-[#fff8e7]">
              Step 1
            </span>
            <span className="rounded-full border border-[#263f35]/10 bg-white/65 px-3 py-1.5 text-xs font-medium text-[#5d5a50]">
              Ask in your own words
            </span>
          </>
        )}
      </div>

      <div className="mt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7a7564]">
          Short Answer
        </p>
        {isLoading ? (
          <div className="mt-5 space-y-3">
            <div className="h-4 w-11/12 animate-pulse rounded-full bg-[#ded5c3]" />
            <div className="h-4 w-10/12 animate-pulse rounded-full bg-[#e7decf]" />
            <div className="h-4 w-7/12 animate-pulse rounded-full bg-[#ded5c3]" />
          </div>
        ) : error ? (
          <p className="mt-5 rounded-2xl border border-[#9b3d32]/20 bg-[#fff3ef] p-4 text-sm leading-6 text-[#8a342a]">
            {error}
          </p>
        ) : result ? (
          <p className="mt-5 max-w-3xl whitespace-pre-line text-xl leading-8 tracking-tight text-[#262820]">
            {result.answer}
          </p>
        ) : (
          <div className="mt-5 max-w-2xl">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Ask in plain language. Check every answer against the verses.
            </h2>
            <p className="mt-4 text-base leading-7 text-[#625f55]">
              Try a feeling, topic, Arabic word, or verse reference. You get a short answer first, then the exact verses underneath.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-3 border-t border-[#263f35]/10 pt-4 sm:grid-cols-3">
        <Metric label="Verses shown" value={String(sources.length)} />
        <Metric label="Citations" value={sources.length > 0 ? "Visible" : "After search"} />
        <Metric label="Language" value={result?.answerLanguage ?? readingLanguage} />
      </div>
    </div>
  );
}

function HowItWorksPanel() {
  const steps = [
    ["Ask naturally", "Use normal words, a feeling, or a verse reference."],
    ["Read briefly", "Get a short answer with citations beside it."],
    ["Check verses", "Open the verse cards underneath before trusting the summary."],
  ];

  return (
    <div className="rounded-[28px] border border-[#263f35]/10 bg-[#203d35] p-5 text-[#fff8e7] shadow-[0_28px_80px_-52px_rgba(52,48,40,0.7)]">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#cabd9c]">
        How It Works
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">
        A simple path through the Quran
      </h2>
      <div className="mt-6 space-y-3">
        {steps.map(([title, body], index) => (
          <div
            key={title}
            className="rounded-2xl border border-white/10 bg-white/[0.075] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-full bg-[#b98b3d] font-mono text-xs font-semibold text-[#21170a]">
                {index + 1}
              </span>
              <p className="text-sm font-semibold">{title}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#d8cfbc]">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConceptPanel({
  result,
  onSearch,
}: {
  result: SearchResponse;
  onSearch: (query: string) => Promise<void>;
}) {
  const lenses = useMemo(
    () => (result.lenses.length > 0 ? result.lenses : ["Patience", "Remembrance", "Prayer"]),
    [result.lenses],
  );

  const nodes = useMemo(() => {
    const positions = [
      { x: 50, y: 13, size: "lg" },
      { x: 19, y: 33, size: "md" },
      { x: 81, y: 34, size: "md" },
      { x: 31, y: 75, size: "sm" },
      { x: 73, y: 73, size: "sm" },
      { x: 50, y: 90, size: "sm" },
    ] as const;

    return lenses.slice(0, 6).map((lens, index) => ({
      lens,
      ...positions[index % positions.length],
      delay: `${index * 80}ms`,
    }));
  }, [lenses]);

  const primaryLens = lenses[0] ?? "Reflection";
  const secondaryLens = lenses[1] ?? "Context";
  const pathData = nodes
    .map((node) => `M 50 52 Q ${(50 + node.x) / 2} ${(52 + node.y) / 2 - 10} ${node.x} ${node.y}`)
    .join(" ");

  const relatedPairs = useMemo(
    () =>
      nodes.slice(0, 4).map((node, index) => ({
        from: node,
        to: nodes[(index + 1) % nodes.length],
      })),
    [nodes],
  );

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#263f35]/10 bg-[#203d35] p-5 text-[#fff8e7] shadow-[0_28px_80px_-52px_rgba(52,48,40,0.7)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#cabd9c]">
            Related Themes
          </p>
          <h2 className="mt-3 max-w-[18ch] text-2xl font-semibold leading-tight tracking-tight">
            Theme constellation
          </h2>
          <p className="mt-2 max-w-[44ch] text-sm leading-6 text-[#d8cfbc]">
            Choose any point to search that theme next.
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#d8cfbc]">
          {nodes.length} links
        </div>
      </div>

      <div className="relative mt-5 h-[300px] overflow-hidden rounded-[24px] border border-white/10 bg-[#112b24] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:h-[360px] xl:h-[420px]">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_center,rgba(255,248,231,0.18)_1px,transparent_1.5px)] [background-size:24px_24px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(185,139,61,0.22),transparent_22%),radial-gradient(circle_at_24%_24%,rgba(255,248,231,0.08),transparent_20%),radial-gradient(circle_at_78%_76%,rgba(255,248,231,0.07),transparent_19%)]" />

        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={pathData}
            fill="none"
            stroke="rgba(255,248,231,0.22)"
            strokeWidth="0.45"
            vectorEffect="non-scaling-stroke"
          />
          {relatedPairs.map((pair, index) => (
            <path
              key={`${pair.from.lens}-${pair.to.lens}`}
              d={`M ${pair.from.x} ${pair.from.y} Q 50 50 ${pair.to.x} ${pair.to.y}`}
              fill="none"
              stroke={index % 2 === 0 ? "rgba(185,139,61,0.38)" : "rgba(255,248,231,0.12)"}
              strokeDasharray={index % 2 === 0 ? "3 4" : "2 5"}
              strokeWidth="0.35"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <circle cx="50" cy="52" r="18" fill="rgba(185,139,61,0.08)" />
          <circle cx="50" cy="52" r="7" fill="rgba(185,139,61,0.34)" />
        </svg>

        <button
          onClick={() => void onSearch(result.query)}
          aria-label={`Search original question: ${result.query}`}
          className="absolute left-1/2 top-[52%] grid size-[86px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#d6b068]/45 bg-[#b98b3d] text-center text-xs font-bold text-[#21170a] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.95)] ring-[12px] ring-[#b98b3d]/10 transition hover:scale-105 focus:outline-none focus:ring-[14px] focus:ring-[#d6b068]/20 active:scale-[0.98]"
        >
          Question
        </button>

        {nodes.map((node, index) => (
          <button
            key={`${node.lens}-${index}`}
            type="button"
            onClick={() => void onSearch(node.lens)}
            aria-label={`Search related theme ${node.lens}`}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-[#f8f0df]/10 text-center font-semibold text-[#f8f0df] shadow-[0_14px_34px_-26px_rgba(0,0,0,0.9)] backdrop-blur-md transition duration-300 hover:scale-105 hover:border-[#d6b068]/55 hover:bg-[#f8f0df]/16 focus:outline-none focus:ring-2 focus:ring-[#d6b068]/60 active:scale-[0.98]",
              node.size === "lg" && "min-w-28 px-4 py-2 text-sm",
              node.size === "md" && "min-w-24 px-3 py-2 text-xs",
              node.size === "sm" && "min-w-20 px-3 py-1.5 text-[11px]",
            )}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              animationDelay: node.delay,
            }}
          >
            {node.lens}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void onSearch(primaryLens)}
          className="rounded-2xl border border-white/10 bg-white/[0.075] p-3 text-left transition hover:border-[#d6b068]/45 hover:bg-white/[0.11] focus:outline-none focus:ring-2 focus:ring-[#d6b068]/50 active:scale-[0.99]"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#cabd9c]">
            Main Lens
          </p>
          <p className="mt-2 text-sm font-semibold">{primaryLens}</p>
        </button>
        <button
          type="button"
          onClick={() => void onSearch(secondaryLens)}
          className="rounded-2xl border border-white/10 bg-white/[0.075] p-3 text-left transition hover:border-[#d6b068]/45 hover:bg-white/[0.11] focus:outline-none focus:ring-2 focus:ring-[#d6b068]/50 active:scale-[0.99]"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#cabd9c]">
            Also Read With
          </p>
          <p className="mt-2 text-sm font-semibold">{secondaryLens}</p>
        </button>
      </div>
    </div>
  );
}

function SourceCard({
  source,
  index,
  onSearch,
}: {
  source: SourceAyah;
  index: number;
  onSearch: (query: string) => Promise<void>;
}) {
  return (
    <article
      className="grid gap-4 rounded-[24px] border border-[#263f35]/10 bg-white/68 p-4 transition hover:-translate-y-0.5 hover:bg-white sm:grid-cols-[minmax(0,0.85fr)_minmax(260px,1.15fr)] sm:p-5"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onSearch(source.reference)}
            aria-label={`Search ${source.reference}`}
            className="rounded-full bg-[#204a3d] px-3 py-1.5 font-mono text-xs text-[#fff8e7] transition hover:bg-[#2a5a4c] focus:outline-none focus:ring-2 focus:ring-[#204a3d]/30 active:scale-[0.98]"
          >
            {source.reference}
          </button>
          <span className="rounded-full border border-[#263f35]/10 px-3 py-1.5 text-xs font-medium text-[#665f52]">
            {source.surahName}
          </span>
          <span className="rounded-full border border-[#263f35]/10 px-3 py-1.5 text-xs font-medium text-[#665f52]">
            {source.revelationType}
          </span>
        </div>
        <p className="mt-4 text-sm font-medium text-[#3a3a32]">Why this was shown</p>
        <p className="mt-2 text-sm leading-6 text-[#696458]">{source.whyMatched}</p>
      </div>

      <div className="space-y-4">
        <p dir="rtl" className="text-right text-2xl leading-[2.1] text-[#1f2822]">
          {source.arabicText}
        </p>
        <p
          dir={source.direction ?? "ltr"}
          className={cn(
            "border-t border-[#263f35]/10 pt-4 text-base leading-7 text-[#464138]",
            source.direction === "rtl" && "text-right",
          )}
        >
          {source.translation}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-xs text-[#7c7663]">
            {formatSource(source.source)}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => void onSearch(source.reference)}
              aria-label={`Search verse ${source.reference}`}
              className="rounded-full border border-[#263f35]/10 px-3 py-2 text-xs font-semibold text-[#3f493f] transition hover:bg-[#f4eddf] active:scale-[0.98]"
            >
              Focus on this verse
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#837d6d]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function SourceSkeleton() {
  return (
    <div className="mt-5 grid gap-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-[24px] border border-[#263f35]/10 bg-white/55 p-5">
          <div className="flex gap-2">
            <div className="h-8 w-20 animate-pulse rounded-full bg-[#ded5c3]" />
            <div className="h-8 w-28 animate-pulse rounded-full bg-[#e7decf]" />
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-4 w-11/12 animate-pulse rounded-full bg-[#ded5c3]" />
            <div className="h-4 w-8/12 animate-pulse rounded-full bg-[#e7decf]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="mt-5 grid min-h-[280px] place-items-center rounded-[24px] border border-dashed border-[#263f35]/18 bg-white/38 p-8 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#204a3d] text-[#fff8e7]">
          <MagnifyingGlass size={22} />
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight">
          Start with one question
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#686458]">
          Ask about a feeling, a topic, or a verse number. The answer will stay linked to Quran citations.
        </p>
        <button
          onClick={onSearch}
          className="mt-5 rounded-full bg-[#204a3d] px-4 py-2 text-sm font-semibold text-[#fff8e7] transition hover:bg-[#2a5a4c] active:scale-[0.98]"
        >
          Try patience and prayer
        </button>
      </div>
    </div>
  );
}

function formatSource(source: string) {
  const knownSources: Record<string, string> = Object.fromEntries(
    readingLanguages.map((language) => [language.edition, language.sourceLabel]),
  );

  return knownSources[source] ?? source;
}
