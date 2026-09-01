// localStorage 数据源管理
import type { DataSource } from "@/types";

const KEY = "lottery11x5:dataSources";

function read(): DataSource[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DataSource[];
  } catch {
    return [];
  }
}

function write(list: DataSource[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listSources(): DataSource[] {
  return read();
}

export function addSource(src: Omit<DataSource, "id" | "createdAt">): DataSource {
  const list = read();
  const item: DataSource = {
    ...src,
    id: `ds_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  if (item.isDefault) {
    list.forEach((s) => (s.isDefault = false));
  }
  list.push(item);
  write(list);
  return item;
}

export function removeSource(id: string) {
  const list = read().filter((s) => s.id !== id);
  write(list);
}

export function setDefault(id: string) {
  const list = read();
  list.forEach((s) => (s.isDefault = s.id === id));
  write(list);
}

export function getDefault(): DataSource | undefined {
  return read().find((s) => s.isDefault);
}
