//! Resource monitoring for CPU, memory, and GPU when running AI captioning.

use serde::Serialize;
use std::process::Command;
use std::str;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

#[derive(Debug, Clone, Serialize, Default)]
pub struct CpuStats {
    pub name: String,
    pub usage_percent: f32,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct MemoryStats {
    pub usage_percent: f32,
    pub used_gb: f32,
    pub total_gb: f32,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct GpuStats {
    pub name: String,
    pub temperature_c: Option<f32>,
    pub fan_percent: Option<f32>,
    pub clock_mhz: Option<u32>,
    pub usage_percent: Option<f32>,
    pub memory_used_gb: Option<f32>,
    pub memory_total_gb: Option<f32>,
    pub memory_usage_percent: Option<f32>,
    pub power_draw_w: Option<f32>,
    pub power_limit_w: Option<f32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResourceStats {
    pub cpu: CpuStats,
    pub memory: MemoryStats,
    pub gpu: Option<GpuStats>,
}

fn parse_float(s: &str) -> Option<f32> {
    s.trim().replace(',', ".").parse().ok()
}

fn parse_u32(s: &str) -> Option<u32> {
    s.trim().replace(',', ".").split('.').next()?.parse().ok()
}

/// Returns current CPU, memory, and GPU (NVIDIA) stats.
#[tauri::command]
pub fn get_resource_stats() -> ResourceStats {
    // CPU and memory via sysinfo
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_memory(MemoryRefreshKind::new().with_ram())
            .with_cpu(CpuRefreshKind::new().with_cpu_usage()),
    );
    sys.refresh_cpu_usage();
    std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
    sys.refresh_cpu_usage();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "CPU".to_string());
    let cpu_usage = sys.global_cpu_usage();

    let total_mem = sys.total_memory();
    let used_mem = sys.used_memory();
    let mem_usage_pct = if total_mem > 0 {
        (used_mem as f64 / total_mem as f64 * 100.0) as f32
    } else {
        0.0
    };
    let used_gb = used_mem as f64 / (1024.0 * 1024.0 * 1024.0);
    let total_gb = total_mem as f64 / (1024.0 * 1024.0 * 1024.0);

    let cpu = CpuStats {
        name: cpu_name,
        usage_percent: cpu_usage,
    };
    let memory = MemoryStats {
        usage_percent: mem_usage_pct,
        used_gb: used_gb as f32,
        total_gb: total_gb as f32,
    };

    // GPU via nvidia-smi (Windows/Linux)
    let gpu = get_nvidia_gpu_stats();

    ResourceStats {
        cpu,
        memory,
        gpu,
    }
}

fn get_nvidia_gpu_stats() -> Option<GpuStats> {
    let output = Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,temperature.gpu,fan.speed,clocks.current.graphics,utilization.gpu,memory.used,memory.total,power.draw,power.limit",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = str::from_utf8(&output.stdout).ok()?;
    let line = stdout.lines().next()?;
    let parts: Vec<&str> = line.split(',').map(str::trim).collect();

    if parts.len() < 9 {
        return None;
    }

    let name = parts.get(0)?.to_string();
    let temperature_c = parse_float(parts.get(1)?);
    let fan_percent = parts
        .get(2)
        .and_then(|s| parse_float(s.trim_end_matches('%')));
    let clock_mhz = parse_u32(parts.get(3)?);
    let usage_percent = parse_float(parts.get(4)?);
    let memory_used_gb = parse_float(parts.get(5)?);
    let memory_total_gb = parse_float(parts.get(6)?);
    let memory_usage_percent = memory_used_gb.zip(memory_total_gb).map(|(u, t)| {
        if t > 0.0 {
            u / t * 100.0
        } else {
            0.0
        }
    });
    let power_draw_w = parse_float(parts.get(7)?);
    let power_limit_w = parse_float(parts.get(8)?);

    Some(GpuStats {
        name,
        temperature_c,
        fan_percent,
        clock_mhz,
        usage_percent,
        memory_used_gb,
        memory_total_gb,
        memory_usage_percent,
        power_draw_w,
        power_limit_w,
    })
}
