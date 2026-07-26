import { Check, ExternalLink, LoaderCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { WashProductPresetImage } from "./WashProductPresetPicker";
import {
  lookupWashProductMetadata,
  type WashProductLookupCandidate,
} from "./productLookup";

type WashProductMetadataLookupProps = {
  query: string;
  onApply: (candidate: WashProductLookupCandidate) => void;
  lookup?: typeof lookupWashProductMetadata;
};

export function WashProductMetadataLookup({
  query,
  onApply,
  lookup = lookupWashProductMetadata,
}: WashProductMetadataLookupProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [candidates, setCandidates] = useState<WashProductLookupCandidate[]>([]);
  const [message, setMessage] = useState("");
  const [appliedUrl, setAppliedUrl] = useState("");
  const normalizedQuery = query.trim();

  useEffect(() => {
    setStatus("idle");
    setCandidates([]);
    setMessage("");
    setAppliedUrl("");
  }, [normalizedQuery]);

  async function searchProducts() {
    if (normalizedQuery.length < 2) return;

    setStatus("loading");
    setCandidates([]);
    setMessage("");
    setAppliedUrl("");

    try {
      const results = await lookup(normalizedQuery);
      setCandidates(results);
      setStatus("success");
      setMessage(results.length === 0 ? "没有找到可用资料，可以继续手动填写。" : "");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "联网查找失败，请稍后重试。");
    }
  }

  function applyCandidate(candidate: WashProductLookupCandidate) {
    onApply(candidate);
    setAppliedUrl(candidate.sourceUrl);
  }

  return (
    <section className="wash-product-lookup">
      <div className="wash-product-lookup-heading">
        <div>
          <strong>联网补全产品资料</strong>
          <p>根据品牌和名称查找图片、简介与来源，确认候选后才会写入。</p>
        </div>
        <button
          className="ghost-button"
          type="button"
          disabled={normalizedQuery.length < 2 || status === "loading"}
          onClick={searchProducts}
        >
          {status === "loading" ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : <Search size={15} aria-hidden="true" />}
          {status === "loading" ? "正在查找" : "联网查找"}
        </button>
      </div>

      {message && <p className={status === "error" ? "lookup-message error" : "lookup-message"}>{message}</p>}

      {candidates.length > 0 && (
        <div className="wash-product-lookup-results" aria-label="联网查找结果">
          {candidates.map((candidate) => {
            const isApplied = appliedUrl === candidate.sourceUrl;
            return (
              <article className={isApplied ? "wash-product-lookup-result applied" : "wash-product-lookup-result"} key={candidate.sourceUrl}>
                {candidate.imageUrl ? (
                  <WashProductPresetImage alt={candidate.title} src={candidate.imageUrl} />
                ) : (
                  <span className="wash-product-lookup-placeholder">暂无图片</span>
                )}
                <div>
                  <strong>{candidate.title}</strong>
                  {(candidate.category || candidate.capacity) && (
                    <span className="wash-product-lookup-suggestion">
                      建议：
                      {candidate.category ?? "未识别类型"}
                      {candidate.capacity ? ` · ${candidate.capacity} ${candidate.capacityUnit ?? ""}` : ""}
                    </span>
                  )}
                  <p>{candidate.description || "该页面没有提供产品简介。"}</p>
                  <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">
                    {getSourceHost(candidate.sourceUrl)}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
                <button className={isApplied ? "secondary-button" : "ghost-button"} type="button" onClick={() => applyCandidate(candidate)}>
                  {isApplied && <Check size={14} aria-hidden="true" />}
                  {isApplied ? "已应用" : "应用资料"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getSourceHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "查看来源";
  }
}
