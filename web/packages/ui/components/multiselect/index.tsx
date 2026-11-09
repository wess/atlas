import { Check, ChevronDown } from "lucide-react";
import { createField } from "../../factory/index.tsx";
import type { ControlProps, OptionInput } from "../../headless/index.tsx";
import { normalizeOptions, useListbox } from "../../headless/index.tsx";

export type MultiSelectOwnProps = {
  data: readonly OptionInput[];
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

const Control = ({
  control,
  data,
  value = [],
  onChange,
  placeholder,
  disabled,
}: MultiSelectOwnProps & { control: ControlProps }) => {
  const items = normalizeOptions(data);
  const listbox = useListbox({
    items,
    isSelected: (option) => value.includes(option),
    onToggle: (option) =>
      onChange?.(value.includes(option) ? value.filter((entry) => entry !== option) : [...value, option]),
    onRemoveLast: () => onChange?.(value.slice(0, -1)),
  });
  const chosen = items.filter((item) => value.includes(item.value));

  return (
    <>
      <button {...control} {...listbox.getTriggerProps()} disabled={disabled} data-listbox="">
        {chosen.length === 0 && <span className="atlas-multiselect__placeholder">{placeholder}</span>}
        {chosen.map((item) => (
          <span key={item.value} className="atlas-multiselect__pill">
            {item.label}
          </span>
        ))}
        <ChevronDown size={14} aria-hidden="true" className="atlas-multiselect__chevron" />
      </button>
      <ul className="atlas-multiselect__list" {...listbox.getListProps()}>
        {items.length === 0 && <li className="atlas-multiselect__empty">No options to choose from</li>}
        {items.map((item, index) => (
          <li key={item.value} className="atlas-multiselect__option" {...listbox.getOptionProps(index)}>
            {item.label}
            {value.includes(item.value) && <Check size={14} aria-hidden="true" />}
          </li>
        ))}
      </ul>
    </>
  );
};

export const MultiSelect = createField<MultiSelectOwnProps>("multiselect", (control, props) => (
  <Control control={control} {...props} />
));
