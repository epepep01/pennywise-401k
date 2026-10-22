"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

type Props = ComponentPropsWithoutRef<"details"> & { errorCount: number };

// Open a closed section when it first gains an error, without preventing the
// person from closing it again. A profile change remounts each section.
export function ValidationDetails({ errorCount, children, ...props }: Props) {
  const details = useRef<HTMLDetailsElement>(null);
  const hadErrors = useRef(false);
  useEffect(() => {
    if (errorCount > 0 && !hadErrors.current && details.current) details.current.open = true;
    hadErrors.current = errorCount > 0;
  }, [errorCount]);
  return <details {...props} ref={details}>{children}</details>;
}

export function SectionErrors({ count }: { count: number }) {
  return count > 0 ? <span className="section-error-count">{count} {count === 1 ? "field to fix" : "fields to fix"}</span> : null;
}
