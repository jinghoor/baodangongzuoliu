import { useEffect, useRef, useState } from "react";

type LanguageOption = {
  label: string;
  value: string;
};

const options: LanguageOption[] = [{ label: "简体中文", value: "zh-CN" }];

const LanguageSelect = () => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<LanguageOption>(options[0]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: LanguageOption) => {
    setCurrent(option);
    setOpen(false);
  };

  return (
    <div className="lang-select-wrapper" ref={wrapperRef}>
      <span className="lang-icon">🌐</span>
      <button
        type="button"
        className="lang-select-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.label}
      </button>
      <span className={`lang-caret${open ? " is-open" : ""}`} aria-hidden="true" />
      {open && (
        <div className="lang-menu" role="listbox" aria-label="语言选择">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`lang-menu-item${
                current.value === option.value ? " active" : ""
              }`}
              onClick={() => handleSelect(option)}
              role="option"
              aria-selected={current.value === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelect;
