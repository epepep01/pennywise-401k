"use client";

import { useEffect, useRef, useState } from "react";

type Option = { value: string; label: string };
type SelectProps = {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
};

export function Select({ id, label, value, options, onChange, describedBy, invalid }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"up" | "down">("down");
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionElements = useRef<(HTMLLIElement | null)[]>([]);
  const search = useRef({ text: "", at: 0 });
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) optionElements.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function show(index = Math.max(0, selectedIndex)) {
    const bounds = root.current?.getBoundingClientRect();
    const height = Math.min(options.length * 44 + 16, 260);
    setSide(bounds && window.innerHeight - bounds.bottom < height && bounds.top > window.innerHeight - bounds.bottom ? "up" : "down");
    setActiveIndex(index);
    setOpen(true);
  }

  function choose(index: number) {
    if (!options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className="app-select" ref={root} data-open={open} data-side={side}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
      <button id={id} ref={trigger} type="button" role="combobox"
        aria-label={label} aria-expanded={open} aria-haspopup="listbox"
        aria-controls={open ? `${id}-options` : undefined}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        aria-describedby={describedBy} aria-invalid={Boolean(invalid)}
        className="app-select-trigger"
        onClick={() => {
          search.current = { text: "", at: 0 };
          if (open) setOpen(false); else show();
        }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) show();
            else setActiveIndex(index => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault(); show(event.key === "Home" ? 0 : options.length - 1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(activeIndex);
            else show();
          } else if (event.key === "Escape") {
            event.preventDefault(); setOpen(false);
          } else if (event.key === "Tab") {
            setOpen(false);
          } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            const now = Date.now();
            const text = (now - search.current.at < 700 ? search.current.text : "") + event.key.toLowerCase();
            search.current = { text, at: now };
            const index = options.findIndex(option => option.label.toLowerCase().startsWith(text));
            if (index !== -1) show(index);
          }
        }}>
        <span className="app-select-value">{selected?.label ?? "Choose an option"}</span>
        <svg className="app-select-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <ul id={`${id}-options`} className="app-select-menu" role="listbox" aria-label={label}>
        {options.map((option, index) => <li key={option.value}
          id={`${id}-option-${index}`} role="option" aria-selected={option.value === value}
          tabIndex={-1} data-active={index === activeIndex}
          ref={element => { optionElements.current[index] = element; }}
          onMouseDown={event => event.preventDefault()}
          onPointerMove={() => setActiveIndex(index)}
          onClick={() => choose(index)}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(index); } }}>
          <span>{option.label}</span><span className="app-select-check" aria-hidden="true">{option.value === value ? "✓" : ""}</span>
        </li>)}
      </ul>}
    </div>
  );
}
