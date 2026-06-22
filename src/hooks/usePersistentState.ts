import { useEffect, useState } from "react";
import { readSetting, writeSetting } from "../lib/storage";

export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readSetting(key, fallback));

  useEffect(() => {
    writeSetting(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
