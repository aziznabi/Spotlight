"use client";
import { useEffect, useState, useCallback } from "react";
export async function api<T = unknown>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch(`/api/erp/${path}`, {
    method,
    headers:
      data instanceof FormData ? {} : { "Content-Type": "application/json" },
    body:
      data === undefined
        ? undefined
        : data instanceof FormData
          ? data
          : JSON.stringify(data),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error ?? "Requête interrompue");
  return b;
}
export function useData<T>(path: string, poll = false) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setData(await api<T>(path));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const interval = poll ? setInterval(refresh, 5000) : undefined;
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [refresh, poll]);
  return { data, error, refresh };
}
