import { isEqual } from "lodash";
import React from "react";

export function useDeepCompareMemoize<T>(value: T) {
  const ref = React.useRef<T>(value);

  if (!isEqual(value, ref.current)) {
    ref.current = value;
  }

  return ref.current;
}

export function useDeepCompareEffect<T>(
  callback: React.EffectCallback,
  dependencies: T[]
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useEffect(callback, dependencies.map(useDeepCompareMemoize));
}
