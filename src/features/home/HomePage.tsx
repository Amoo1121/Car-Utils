import { AlertTriangle, ArrowRight, BellRing, CalendarClock, Car, Droplets, Fuel, Plus, Receipt, Settings2, Wrench, Zap } from "lucide-react";
import { useMemo } from "react";
import { calculateConsumption, calculateFuelPriceStats } from "../../domain/analytics/consumption";
import { monthlyCosts, summarizeCosts } from "../../domain/analytics/costAnalytics";
import { buildReminders, type Reminder } from "../../domain/reminders/reminders";
import { buildTimeline } from "../../domain/timeline/timeline";
import { estimateOdometer } from "../../domain/vehicle/odometer";
import { filterActive } from "../../shared/carData";
import { useWorkspace } from "../../app/workspace";
import { StackedBars } from "../../ui/charts";
import { EmptyState } from "../../ui/EmptyState";
import { km, money, num, shortMonth } from "../../ui/format";
import { TimelineRow } from "../timeline/TimelineRow";
import { categoryColors } from "../../ui/palette";

export function HomePage() {
  const workspace = useWorkspace();
  const { vehicle, fuelRecords, washRecords, expenseRecords, allFuelRecords, openEditor, navigate, session, allVehicles } = workspace;

  const data = useMemo(() => {
    if (!vehicle) return null;
    const fuel = filterActive(fuelRecords);
    const wash = filterActive(washRecords);
    const expense = filterActive(expenseRecords);
    const records = { fuelRecords: fuel, washRecords: wash, expenseRecords: expense };
    return {
      odometer: estimateOdometer(vehicle, [...allFuelRecords, ...washRecords, ...expenseRecords]),
      consumption: calculateConsumption(vehicle, fuel),
      price: calculateFuelPriceStats(fuel),
      month: summarizeCosts(vehicle, records, "30d"),
      year: summarizeCosts(vehicle, records, "12m"),
      months: monthlyCosts(records, 6),
      reminders: buildReminders({ vehicle, fuelRecords: fuel, washRecords: wash, expenseRecords: expense }),
      recent: buildTimeline(records).slice(0, 6),
      total: fuel.length + wash.length + expense.length,
    };
  }, [allFuelRecords, expenseRecords, fuelRecords, vehicle, washRecords]);

  if (!vehicle || !data) {
    return (
      <EmptyState
        action={
          <button className="button button-primary" type="button" onClick={() => openEditor({ kind: "vehicle" })}>
            <Plus size={18} />
            添加我的车
          </button>
        }
        icon={<Car size={36} />}
        secondary={
          allVehicles.length > 0 ? undefined : (
            <button className="button button-ghost" type="button" onClick={() => navigate("settings", "data")}>
              从备份导入
            </button>
          )
        }
        title={`欢迎，${session.authUser?.displayName ?? ""}`}
      >
        添加车辆后，加油、洗车、保养和各种费用都会按车独立记录，自动算出油耗、每公里成本，并在保险、年检、保养到期前提醒你。
      </EmptyState>
    );
  }

  const isEv = vehicle.energyType === "纯电";
  const unit = data.consumption.unit;
  const greeting = (() => {
    const hour = new Date().getHours();
    return hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
  })();

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-top">
          <div>
            <p className="hero-greeting">
              {greeting}，{session.authUser?.displayName}
            </p>
            <h1>{vehicle.nickname}</h1>
            <p className="hero-meta">
              {[`${vehicle.brand} ${vehicle.model}`.trim(), vehicle.year && `${vehicle.year} 款`, vehicle.plate, vehicle.energyType].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button aria-label="编辑车辆" className="icon-button hero-edit" type="button" onClick={() => openEditor({ kind: "vehicle", vehicleId: vehicle.id })}>
            <Settings2 size={18} />
          </button>
        </div>
        <div className="odometer" aria-label={`总里程 ${km(data.odometer.latest)}`}>
          <span className="odometer-value">{data.odometer.latest ? Math.round(data.odometer.latest).toLocaleString("zh-CN") : "—"}</span>
          <span className="odometer-unit">km</span>
          {data.odometer.dailyDistance && <span className="odometer-rate">日均 {num(data.odometer.dailyDistance, 0)} km</span>}
        </div>
        <dl className="hero-stats">
          <div>
            <dt>近 30 天花费</dt>
            <dd>{money(data.month.total)}</dd>
          </div>
          <div>
            <dt>{isEv ? "实际电耗" : "实际油耗"}</dt>
            <dd>
              {data.consumption.average > 0 ? (
                <>
                  {num(data.consumption.average, 1)}
                  <small> {unit}/100km</small>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>每公里成本</dt>
            <dd>{data.year.costPerKm > 0 ? <>{money(data.year.costPerKm, true)}<small>/km</small></> : "—"}</dd>
          </div>
          <div>
            <dt>{isEv ? "最近电价" : "最近油价"}</dt>
            <dd>{data.price.latestUnitPrice ? <>{money(data.price.latestUnitPrice, true)}<small>/{unit}</small></> : "—"}</dd>
          </div>
        </dl>
        {data.consumption.hint && data.price.totalVolume > 0 && (
          <p className="hero-hint">
            <AlertTriangle size={14} />
            {data.consumption.hint}
          </p>
        )}
      </section>

      <section className="quick-row" aria-label="快速记录">
        <button className="quick-chip tone-fuel" type="button" onClick={() => openEditor({ kind: "fuel" })}>
          {isEv ? <Zap size={20} /> : <Fuel size={20} />}
          <span>{isEv ? "充电" : "加油"}</span>
        </button>
        <button className="quick-chip tone-wash" type="button" onClick={() => openEditor({ kind: "wash" })}>
          <Droplets size={20} />
          <span>洗车</span>
        </button>
        <button className="quick-chip tone-expense" type="button" onClick={() => openEditor({ kind: "expense", category: "maintenance" })}>
          <Wrench size={20} />
          <span>保养</span>
        </button>
        <button className="quick-chip tone-expense" type="button" onClick={() => openEditor({ kind: "expense" })}>
          <Receipt size={20} />
          <span>费用</span>
        </button>
      </section>

      <div className="home-grid">
        <section className="card">
          <header className="card-head">
            <h2>
              <BellRing size={17} />
              提醒
            </h2>
            {data.reminders.length > 0 && <span className="badge">{data.reminders.length}</span>}
          </header>
          {data.reminders.length === 0 ? (
            <div className="card-empty">
              <CalendarClock size={22} />
              <p>暂无待办。记录保养、保险、年检时设置下次到期，这里就会提前提醒。</p>
              <button className="button button-soft button-sm" type="button" onClick={() => openEditor({ kind: "expense", category: "insurance" })}>
                添加保险 / 年检
              </button>
            </div>
          ) : (
            <ul className="reminder-list">
              {data.reminders.slice(0, 5).map((reminder) => (
                <ReminderItem key={reminder.id} reminder={reminder} />
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="card-head">
            <h2>近 6 个月支出</h2>
            <button className="link-button" type="button" onClick={() => navigate("insights")}>
              查看洞察 <ArrowRight size={14} />
            </button>
          </header>
          <StackedBars
            data={data.months.map((month) => ({ ...month, label: shortMonth(month.month) }))}
            format={(value) => money(value)}
            height={150}
            series={[
              { key: "fuel", label: isEv ? "充电" : "加油", color: categoryColors.fuel },
              { key: "wash", label: "洗车", color: categoryColors.wash },
              { key: "expense", label: "其他", color: categoryColors.expense },
            ]}
          />
        </section>
      </div>

      <section className="card">
        <header className="card-head">
          <h2>最近记录</h2>
          {data.total > 0 && (
            <button className="link-button" type="button" onClick={() => navigate("timeline")}>
              全部 {data.total} 条 <ArrowRight size={14} />
            </button>
          )}
        </header>
        {data.recent.length === 0 ? (
          <div className="card-empty">
            <p>还没有记录。点击上方按钮记下第一笔，或按键盘 N。</p>
          </div>
        ) : (
          <ul className="timeline-list">
            {data.recent.map((entry) => (
              <TimelineRow entry={entry} key={entry.id} unit={unit} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ReminderItem({ reminder }: { reminder: Reminder }) {
  const { openEditor, vehicle } = useWorkspace();
  const action =
    reminder.kind === "expense"
      ? { label: "已完成", run: () => openEditor({ kind: "expense", renewFromId: reminder.sourceId }) }
      : reminder.kind === "wash"
        ? { label: "去记录", run: () => openEditor({ kind: "wash" }) }
        : { label: "去填写", run: () => vehicle && openEditor({ kind: "vehicle", vehicleId: vehicle.id }) };
  return (
    <li className={`reminder severity-${reminder.severity}`}>
      <span className="reminder-dot" aria-hidden="true" />
      <div className="reminder-copy">
        <strong>{reminder.title}</strong>
        <small>{reminder.detail}</small>
      </div>
      <button className="button button-soft button-sm" type="button" onClick={action.run}>
        {action.label}
      </button>
    </li>
  );
}
