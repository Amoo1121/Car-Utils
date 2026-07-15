import { useMemo } from "react";
import { Autocomplete } from "../../components/forms/Autocomplete";
import { buildFuelStationSuggestions } from "../../domain/fuel/stationSuggestions";
import type { FuelRecord } from "../../domain/store/types";

export type FuelStationFieldProps = {
  fuelRecords: FuelRecord[];
  vehicleId: string;
  value: string;
  onChange: (value: string) => void;
};

export function FuelStationField({ fuelRecords, vehicleId, value, onChange }: FuelStationFieldProps) {
  const suggestions = useMemo(
    () => buildFuelStationSuggestions(fuelRecords, { vehicleId, query: value, limit: 6 }),
    [fuelRecords, vehicleId, value],
  );
  const options = suggestions.map((suggestion) => ({
    value: suggestion.name,
    label: suggestion.name,
    description: formatSuggestionDescription(suggestion.currentVehicleUseCount, suggestion.useCount, suggestion.lastUsedDate),
  }));

  return (
    <Autocomplete
      label="加油站"
      onChange={onChange}
      options={options}
      placeholder="输入名称，可选择历史加油站"
      value={value}
    />
  );
}

function formatSuggestionDescription(currentVehicleUseCount: number, useCount: number, lastUsedDate: string) {
  const scope = currentVehicleUseCount > 0 ? `本车 ${currentVehicleUseCount} 次` : `其他车辆 ${useCount} 次`;
  return `${scope} · 最近 ${lastUsedDate}`;
}
