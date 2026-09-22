import { ArrowUpRight, Box, ScanLine } from "lucide-react";
import { Link } from "react-router-dom";
import type { Asset, Page, Slot } from "../api";
import { PartIcon, useData } from "../shared";
import { ErrorBox, Loading } from "../ui";

/** A live relationship drawing, not an illustration of a particular hardware model. */
export default function AssetBlueprint() {
  const assets = useData<Page<Asset>>("spotlight-asset", "/assets?page_size=1");
  const asset = assets.data?.items[0];
  const composition = useData<{ items: Slot[] }>(
    "composition",
    `/assets/${asset?.id}/components`,
    !!asset,
  );
  const slots = composition.data?.items ?? [];
  if (assets.error || composition.error)
    return (
      <div className="blueprint">
        <ErrorBox error={assets.error || composition.error} />
      </div>
    );
  if (assets.isLoading || (asset && composition.isLoading))
    return (
      <div className="blueprint">
        <Loading />
      </div>
    );
  return (
    <figure className="blueprint" aria-label="真实资产当前组成示意">
      <div className="blueprint-header">
        <span>
          <ScanLine size={15} /> COMPOSITION / 当前组成
        </span>
        <span className="blueprint-reference">FIG. 01</span>
      </div>
      {asset ? (
        <>
          <div className="blueprint-map">
            <svg
              className="blueprint-lines"
              viewBox="0 0 520 240"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M120 53H192L228 104M400 53H328L292 104M120 187H192L228 136M400 187H328L292 136" />
              <path className="blueprint-axis" d="M260 0V240M0 120H520" />
              <circle cx="260" cy="120" r="59" />
              <circle cx="260" cy="120" r="76" className="blueprint-axis" />
            </svg>
            <div className="blueprint-core">
              <Box size={37} strokeWidth={1} />
              <strong>{asset.asset_code}</strong>
              <span>ASSET IDENTITY</span>
            </div>
            {slots.slice(0, 4).map((slot, i) => {
              const content = (
                <>
                  <span className="blueprint-port">
                    0{i + 1} <PartIcon type={slot.allowed_type} />
                  </span>
                  <strong>{slot.serial_no ?? "EMPTY"}</strong>
                  <span>{slot.slot_name}</span>
                </>
              );
              return slot.component_id ? (
                <Link
                  className={`blueprint-part port-${i + 1}`}
                  key={slot.slot_id}
                  to={`/components/${slot.component_id}`}
                  aria-label={`追溯 ${slot.serial_no}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  className={`blueprint-part port-${i + 1}`}
                  key={slot.slot_id}
                >
                  {content}
                </div>
              );
            })}
            {slots.length === 0 && (
              <p className="blueprint-no-slots">
                登记槽位后，在这里查看组成关系。
              </p>
            )}
          </div>
          <figcaption>
            <span>
              <i /> {slots.filter((s) => s.component_id).length} /{" "}
              {slots.length} 槽位已安装
            </span>
            <Link to={`/assets/${asset.id}`}>
              打开资产档案 <ArrowUpRight size={15} />
            </Link>
          </figcaption>
        </>
      ) : (
        <div className="blueprint-empty">
          <Box size={40} strokeWidth={1} />
          <p>登记第一台资产，开始记录它的来历。</p>
        </div>
      )}
    </figure>
  );
}
