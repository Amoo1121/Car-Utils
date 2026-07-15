import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";

export type AutocompleteOption = {
  value: string;
  label: string;
  description?: string;
};

export type AutocompleteProps = {
  label: ReactNode;
  value: string;
  options: AutocompleteOption[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export function Autocomplete({ label, value, options, onChange, placeholder }: AutocompleteProps) {
  const inputId = useId();
  const listId = `${inputId}-listbox`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [options]);

  const showOptions = isOpen && options.length > 0;

  function selectOption(option: AutocompleteOption) {
    onChange(option.value);
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, options.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter" && showOptions) {
      event.preventDefault();
      selectOption(options[activeIndex]);
    }
  }

  return (
    <div className="autocomplete-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        aria-activedescendant={showOptions ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showOptions}
        autoComplete="off"
        id={inputId}
        placeholder={placeholder}
        role="combobox"
        value={value}
        onBlur={() => setIsOpen(false)}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {showOptions && (
        <div className="autocomplete-list" id={listId} role="listbox">
          {options.map((option, index) => (
            <button
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "autocomplete-option active" : "autocomplete-option"}
              id={`${listId}-${index}`}
              key={option.value}
              role="option"
              type="button"
              onClick={() => selectOption(option)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span>{option.label}</span>
              {option.description && <small>{option.description}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
