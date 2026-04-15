"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { sidebarItems } from "@/navigation/sidebar-items";

interface SearchItem {
  group: string;
  label: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

// Transform sidebar items into search items
const transformSidebarItemsToSearchItems = (): SearchItem[] => {
  const items: SearchItem[] = [];

  sidebarItems.forEach((group) => {
    group.items.forEach((item) => {
      // Add main item
      items.push({
        group: group.label || "Main",
        label: item.title,
        url: item.url,
        icon: item.icon,
        disabled: item.comingSoon,
      });

      // Add subItems if they exist
      if (item.subItems) {
        item.subItems.forEach((subItem) => {
          items.push({
            group: group.label || "Main",
            label: `${item.title} - ${subItem.title}`,
            url: subItem.url,
            icon: subItem.icon || item.icon,
            disabled: subItem.comingSoon,
          });
        });
      }
    });
  });

  return items;
};

const searchItems = transformSidebarItemsToSearchItems();

export function SearchDialog() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (item: SearchItem) => {
    if (!item.disabled && item.url) {
      router.push(item.url);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="link"
        className="text-gray-500 dark:text-gray-400 !px-0 font-normal hover:no-underline"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        Search
        <kbd className="bg-gray-100 dark:bg-gray-800 inline-flex h-5 items-center gap-1 rounded border border-gray-200 dark:border-gray-800 px-1.5 text-[10px] font-medium select-none">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search reports, data, clients, and more…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {[...new Set(searchItems.map((item) => item.group))].map((group, i) => (
            <React.Fragment key={group}>
              {i !== 0 && <CommandSeparator />}
              <CommandGroup heading={group} key={group}>
                {searchItems
                  .filter((item) => item.group === group)
                  .map((item) => (
                    <CommandItem
                      className="!py-1.5"
                      key={`${item.group}-${item.label}`}
                      onSelect={() => handleSelect(item)}
                      disabled={item.disabled}
                    >
                      {item.icon && <item.icon className="size-4" />}
                      <span>{item.label}</span>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
