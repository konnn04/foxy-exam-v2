import React, { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  isSearchable?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục...',
  isSearchable = false,
  className,
  triggerClassName,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = isSearchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-8 justify-between text-xs font-normal border-border/80 bg-background hover:bg-muted/40 px-2.5 min-w-[130px] rounded-md shadow-2xs transition-colors',
            triggerClassName
          )}
        >
          <span className="truncate text-foreground">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown className="ml-1.5 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(
          'w-56 p-1 text-xs bg-popover border-border text-popover-foreground shadow-md rounded-md z-50',
          className
        )}
        align="start"
      >
        {isSearchable && (
          <div className="flex items-center px-2 py-1.5 border-b border-border/60 mb-1">
            <Search className="size-3 text-muted-foreground mr-1.5 shrink-0" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-hidden border-none p-0 focus:ring-0"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}

        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {filteredOptions.length === 0 ? (
            <div className="py-2.5 text-center text-muted-foreground text-[11px]">
              Không tìm thấy mục phù hợp
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer text-xs transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted/60 text-foreground'
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" />}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
