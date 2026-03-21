export type PointGroup = {
  pointUnit: string;
  laborCostPerHour: number;
  timeUnit: string;
};

export const TIME_UNIT_LABEL: Record<string, string> = {
  YEN: "円",
  HOUR: "人・時間",
  DAY: "人・日",
  WEEK: "人・週",
  MONTH: "人・月",
};

const TIME_UNIT_MULTIPLIER: Record<string, number> = {
  HOUR: 1,
  DAY: 1 / 8,
  WEEK: 1 / (8 * 5),
  MONTH: 1 / (8 * 5 * 4),
};

export function formatPoint(points: number, group: PointGroup): string {
  if (group.pointUnit === "円") {
    if (group.timeUnit === "YEN" || !group.laborCostPerHour) {
      return `${points.toLocaleString("ja-JP")} 円`;
    }
    const personHours = points / group.laborCostPerHour;
    const value = personHours * (TIME_UNIT_MULTIPLIER[group.timeUnit] ?? 1);
    return `${value.toLocaleString("ja-JP")} ${TIME_UNIT_LABEL[group.timeUnit]}`;
  }
  return `${points} pt`;
}

export function unitLabel(group: PointGroup): string {
  if (group.pointUnit !== "円") return "pt";
  if (group.timeUnit === "YEN" || !group.laborCostPerHour) return "円";
  return TIME_UNIT_LABEL[group.timeUnit] ?? "円";
}
