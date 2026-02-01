import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, Thermometer, Fan, Clock, Zap, Activity } from "lucide-react";
import { getResourceStats } from "@/lib/tauri";

interface ResourceMonitorProps {
  /** Only shown when true */
  visible: boolean;
}

function ProgressBar({ percent, color = "bg-blue-500" }: { percent: number; color?: string }) {
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-700">
      <div
        className={`h-full transition-all duration-300 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function ResourceMonitor({ visible }: ResourceMonitorProps) {
  const { data: stats } = useQuery({
    queryKey: ["resource-stats"],
    queryFn: getResourceStats,
    enabled: visible,
    refetchInterval: visible ? 1500 : false,
  });

  if (!visible) return null;
  if (!stats) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-surface-elevated px-4 py-2 text-xs">
      {/* CPU */}
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-gray-500" aria-hidden />
        <span className="max-w-[140px] truncate font-medium text-gray-200" title={stats.cpu.name}>
          {stats.cpu.name}
        </span>
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-green-500" aria-hidden />
          <span className="text-green-400">{stats.cpu.usage_percent.toFixed(1)}%</span>
          <ProgressBar percent={stats.cpu.usage_percent} color="bg-green-500" />
        </div>
      </div>

      {/* Memory */}
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-gray-500" aria-hidden />
        <span className="text-gray-400">Memory</span>
        <span className="text-blue-400">{stats.memory.usage_percent.toFixed(1)}%</span>
        <ProgressBar percent={stats.memory.usage_percent} color="bg-blue-500" />
        <span className="text-gray-500">
          {stats.memory.used_gb.toFixed(1)} / {stats.memory.total_gb.toFixed(1)} GB
        </span>
      </div>

      {/* GPU */}
      {stats.gpu && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="max-w-[160px] truncate font-medium text-gray-200" title={stats.gpu.name}>
            {stats.gpu.name}
          </span>
          {stats.gpu.temperature_c != null && (
            <div className="flex items-center gap-1.5">
              <Thermometer className="h-3.5 w-3.5 text-green-500" aria-hidden />
              <span className="text-green-400">{Math.round(stats.gpu.temperature_c)}°C</span>
            </div>
          )}
          {stats.gpu.fan_percent != null && (
            <div className="flex items-center gap-1.5">
              <Fan className="h-3.5 w-3.5 text-blue-500" aria-hidden />
              <span className="text-blue-400">{Math.round(stats.gpu.fan_percent)}%</span>
            </div>
          )}
          {stats.gpu.clock_mhz != null && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-purple-500" aria-hidden />
              <span className="text-purple-400">{stats.gpu.clock_mhz} MHz</span>
            </div>
          )}
          {stats.gpu.usage_percent != null && (
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-green-500" aria-hidden />
              <span className="text-green-400">{Math.round(stats.gpu.usage_percent)}%</span>
              <ProgressBar percent={stats.gpu.usage_percent} color="bg-green-500" />
            </div>
          )}
          {stats.gpu.memory_usage_percent != null && stats.gpu.memory_total_gb != null && (
            <div className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5 text-blue-500" aria-hidden />
              <span className="text-blue-400">{stats.gpu.memory_usage_percent.toFixed(1)}%</span>
              <ProgressBar percent={stats.gpu.memory_usage_percent} color="bg-blue-500" />
              <span className="text-gray-500">
                {stats.gpu.memory_used_gb?.toFixed(1)} / {stats.gpu.memory_total_gb.toFixed(1)} GB
              </span>
            </div>
          )}
          {stats.gpu.power_draw_w != null && stats.gpu.power_limit_w != null && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden />
              <span className="text-amber-400">
                {stats.gpu.power_draw_w.toFixed(1)}W / {stats.gpu.power_limit_w.toFixed(0)}W
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
