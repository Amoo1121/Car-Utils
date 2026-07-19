import { ExternalLink, PackageOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  filterWashProductPresets,
  washProductPresets,
  type WashProductPreset,
} from "../../domain/wash/washProductCatalog";

export type WashProductPresetPickerProps = {
  selectedPresetId?: string;
  onSelect: (preset: WashProductPreset) => void;
};

export function WashProductPresetPicker({ selectedPresetId, onSelect }: WashProductPresetPickerProps) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("all");
  const brands = useMemo(() => [...new Set(washProductPresets.map((preset) => preset.brand))], []);
  const filteredPresets = useMemo(() => filterWashProductPresets(query, brand), [brand, query]);

  return (
    <details className="wash-preset-library">
      <summary>
        <span>
          <PackageOpen size={17} />
          从常用产品库选择
        </span>
        <small>{washProductPresets.length} 个常用耗材</small>
      </summary>

      <div className="wash-preset-content">
        <div className="wash-preset-toolbar">
          <label className="wash-preset-search">
            <span>搜索产品</span>
            <div>
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="品牌、型号或用途"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </label>
          <label>
            品牌
            <select value={brand} onChange={(event) => setBrand(event.target.value)}>
              <option value="all">全部品牌</option>
              {brands.map((brandName) => (
                <option key={brandName} value={brandName}>
                  {brandName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="wash-preset-grid">
          {filteredPresets.map((preset) => (
            <article className={selectedPresetId === preset.id ? "wash-preset-card selected" : "wash-preset-card"} key={preset.id}>
              <button type="button" onClick={() => onSelect(preset)} aria-label={`使用 ${preset.brand} ${preset.name}`}>
                <WashProductPresetImage alt={`${preset.brand} ${preset.name}`} src={preset.imageUrl} />
                <span className="wash-preset-card-copy">
                  <small>{preset.brand}</small>
                  <strong>{preset.name}</strong>
                  <span>
                    {preset.category} · {preset.defaultCapacity} {preset.capacityUnit}
                  </span>
                  {preset.defaultDilutionRatio && <span>{preset.defaultDilutionRatio}</span>}
                </span>
              </button>
              <a href={preset.sourceUrl} target="_blank" rel="noreferrer">
                官方资料
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </article>
          ))}
          {filteredPresets.length === 0 && <p className="empty wash-preset-empty">没有匹配的预置产品，仍然可以在下方手动填写。</p>}
        </div>
      </div>
    </details>
  );
}

export function WashProductPresetImage({ alt, src }: { alt: string; src: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="wash-preset-image">
      {failed ? <PackageOpen size={30} aria-label={`${alt} 图片暂不可用`} /> : <img alt={alt} loading="lazy" src={src} onError={() => setFailed(true)} />}
    </span>
  );
}
