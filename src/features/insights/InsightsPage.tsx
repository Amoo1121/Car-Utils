import { BarChart3, Gauge, Info, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateConsumption } from "../../domain/analytics/consumption";
import { costPeriodLabels, filterByPeriod, monthlyCosts, summarizeCosts, type CostPeriod } from "../../domain/analytics/costAnalytics";
import { calculateFuelInsights } from "../../domain/analytics/fuelAnalytics";
import { compactDate, filterActive, paidUnitPrice } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { BarList, LineChart, StackedBars } from "../../ui/charts";
import { EmptyState } from "../../ui/EmptyState";
import { Segmented } from "../../ui/fields";
import { km, money, num, shortMonth } from "../../ui/format";
import { categoryColors } from "../../ui/palette";

const confidenceLabels = { none: "暂无数据", low: "样本较少", medium: "较可靠", high: "可靠" } as const;

export function InsightsPage() {
  const { vehicle, fuelRecords, washRecords, expenseRecords, openEditor } = useWorkspace();
  const [period, setPeriod] = useState<CostPeriod>("12m");

  const data = useMemo(() => {
    if (!vehicle) return null;
    const fuel = filterActive(fuelRecords);
    const wash = filterActive(washRecords);
    const expense = filterActive(expenseRecords);
    const records = { fuelRecords: fuel, washRecords: wash, expenseRecords: expense };
    const summary = summarizeCosts(vehicle, records, period);
    const consumption = calculateConsumption(vehicle, fuel);
    const periodFuel = filterByPeriod(fuel, period).sort((a, b) => a.date.localeCompare(b.date));
    const months = period === "30d" || period === "90d" ? 6 : period === "all" ? Math.max(monthsSpan(records), 6) : 12;
    const periodWash = filterByPeriod(wash, period);
    return {
      summary,
      consumption,
      months: monthlyCosts(records, Math.min(months, 36)),
      pricePoints: periodFuel.slice(-24).map((record) => ({ label: compactDate(record.date), value: paidUnitPrice(record), detail: record.station || undefined })),
      stations: calculateFuelInsights(vehicle, periodFuel),
      wash: {
        count: periodWash.length,
        average: periodWash.length ? periodWash.reduce((sum, record) => sum + record.cost, 0) / periodWash.length : 0,
        interval: averageInterval(periodWash.map((record) => record.date)),
      },
    };
  }, [expenseRecords, fuelRecords, period, vehicle, washRecords]);

  if (!vehicle || !data) {
    return <EmptyState icon={<BarChart3 size={36} />} title="还没有车辆">添加车辆并记录几笔后，这里会显示油耗、成本和趋势。</EmptyState>;
  }

  const { summary, consumption } = data;
  const unit = consumption.unit;
  const isEv = unit === "kWh";

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <h1>洞察</h1>
          <p>{vehicle.nickname} · {costPeriodLabels[period]}</p>
        </div>
        <Segmented
          label="统计周期"
          options={(Object.keys(costPeriodLabels) as CostPeriod[]).map((value) => ({ value, label: costPeriodLabels[value] }))}
          size="sm"
          value={period}
          onChange={setPeriod}
        />
      </header>

      <section className="kpi-grid">
        <Kpi label="总支出" value={money(summary.total)} detail={`${summary.recordCount} 笔`} />
        <Kpi label="行驶里程" value={km(summary.distance)} detail={summary.distance ? "根据各记录里程推算" : "记录里程后可统计"} />
        <Kpi label="每公里成本" value={summary.costPerKm ? `${money(summary.costPerKm, true)}` : "—"} detail="含加油、洗车与全部费用" />
        <Kpi
          label={isEv ? "平均电耗" : "平均油耗"}
          value={consumption.average ? `${num(consumption.average, 2)}` : "—"}
          unit={consumption.average ? `${unit}/100km` : undefined}
          detail={consumption.average ? `${confidenceLabels[consumption.confidence]} · ${consumption.intervals.length} 个区间` : consumption.hint ?? ""}
        />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>月度支出</h2>
          <span className="card-sub">
            {isEv ? "充电" : "加油"} {money(summary.fuel)} · 洗车 {money(summary.wash)} · 其他 {money(summary.expense)}
          </span>
        </header>
        <StackedBars
          data={data.months.map((month) => ({ ...month, label: shortMonth(month.month) }))}
          format={(value) => money(value)}
          labelFor={(item) => item.label}
          series={[
            { key: "fuel", label: isEv ? "充电" : "加油", color: categoryColors.fuel },
            { key: "wash", label: "洗车", color: categoryColors.wash },
            { key: "expense", label: "其他费用", color: categoryColors.expense },
          ]}
        />
      </section>

      <div className="two-col">
        <section className="card">
          <header className="card-head">
            <h2>
              <Gauge size={17} />
              {isEv ? "电耗" : "油耗"}趋势
            </h2>
            {consumption.recent > 0 && (
              <span className="card-sub">
                最近 {num(consumption.recent, 1)} {unit}/100km
              </span>
            )}
          </header>
          {consumption.intervals.length > 0 ? (
            <>
              <LineChart
                color={categoryColors.fuel}
                format={(value) => `${num(value, 2)} ${unit}/100km`}
                points={consumption.intervals.slice(-20).map((interval) => ({
                  label: compactDate(interval.toDate),
                  value: interval.per100km,
                  detail: `${km(interval.distance)}${interval.method === "full_tank" ? " · 满箱法" : " · 油表法"}`,
                }))}
                referenceLabel={`均值 ${num(consumption.average, 1)}`}
                referenceValue={consumption.average}
              />
              <dl className="mini-stats">
                {consumption.best && (
                  <div>
                    <dt>最省</dt>
                    <dd>{num(consumption.best.per100km, 1)} · {consumption.best.toDate}</dd>
                  </div>
                )}
                {consumption.worst && (
                  <div>
                    <dt>最费</dt>
                    <dd>{num(consumption.worst.per100km, 1)} · {consumption.worst.toDate}</dd>
                  </div>
                )}
                <div>
                  <dt>统计里程</dt>
                  <dd>{km(consumption.totalDistance)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="card-empty">
              <Info size={20} />
              <p>{consumption.hint}</p>
              {consumption.hint?.includes("容量") && (
                <button className="button button-soft button-sm" type="button" onClick={() => openEditor({ kind: "vehicle", vehicleId: vehicle.id })}>
                  填写容量
                </button>
              )}
            </div>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <h2>{isEv ? "电价" : "油价"}走势</h2>
            <span className="card-sub">实付单价</span>
          </header>
          <LineChart color="var(--accent)" format={(value) => `${money(value, true)}/${unit}`} points={data.pricePoints} />
        </section>
      </div>

      <div className="two-col">
        <section className="card">
          <header className="card-head">
            <h2>
              <Trophy size={17} />
              {isEv ? "充电站" : "加油站"}
            </h2>
            <span className="card-sub">按次数</span>
          </header>
          <BarList
            format={(value) => `${value} 次`}
            items={data.stations.stationSummaries.slice(0, 6).map((station) => ({
              label: station.station,
              value: station.recordCount,
              color: categoryColors.fuel,
              detail: `均价 ${money(station.avgUnitPrice, true)}/${unit} · 共 ${num(station.totalVolume, 0)} ${unit}`,
            }))}
          />
          {data.stations.canCompareStations && (
            <div className="station-compare">
              <h3>谁家更耐跑</h3>
              <ul>
                {data.stations.stationPerformances.slice(0, 4).map((item) => (
                  <li key={`${item.station}-${item.grade}`}>
                    <span>
                      {item.station} · {item.grade}
                    </span>
                    <strong className={item.relativeToAverage >= 0 ? "positive" : "warn"}>
                      {item.relativeToAverage >= 0 ? "+" : ""}
                      {num(item.relativeToAverage, 1)}%
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <h2>费用构成</h2>
          </header>
          <BarList
            format={(value) => money(value)}
            items={[
              ...(summary.fuel > 0 ? [{ label: isEv ? "充电" : "加油", value: summary.fuel, color: categoryColors.fuel }] : []),
              ...(summary.wash > 0
                ? [{ label: "洗车", value: summary.wash, color: categoryColors.wash, detail: data.wash.count ? `${data.wash.count} 次 · 平均 ${money(data.wash.average)}${data.wash.interval ? ` · 约每 ${num(data.wash.interval, 0)} 天` : ""}` : undefined }]
                : []),
              ...summary.byExpenseCategory.map((item) => ({ label: item.label, value: item.amount, color: categoryColors.expense, detail: `${item.count} 笔` })),
            ].sort((a, b) => b.value - a.value)}
          />
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, detail }: { label: string; value: string; unit?: string; detail?: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>
        {value}
        {unit && <small> {unit}</small>}
      </strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function averageInterval(dates: string[]) {
  const sorted = [...dates].sort();
  if (sorted.length < 2) return 0;
  const first = new Date(sorted[0]).getTime();
  const last = new Date(sorted.at(-1)!).getTime();
  return (last - first) / 86_400_000 / (sorted.length - 1);
}

function monthsSpan(records: { fuelRecords: { date: string }[]; washRecords: { date: string }[]; expenseRecords: { date: string }[] }) {
  const dates = [...records.fuelRecords, ...records.washRecords, ...records.expenseRecords].map((item) => item.date).sort();
  if (!dates.length) return 0;
  const first = dates[0];
  const now = new Date();
  return (now.getFullYear() - Number(first.slice(0, 4))) * 12 + now.getMonth() + 1 - Number(first.slice(5, 7)) + 1;
}
