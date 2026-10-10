import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../../context/ThemeContext";
import { IconButton } from "../../../components/ui";

// Sun and moon cross-fade with a quarter turn as the theme flips; the label
// names the theme you'd switch to, which is what the click will do.
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <IconButton title={`Switch to ${next} theme`} onClick={toggleTheme} className="relative">
      <Sun className="size-[18px] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-[18px] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
    </IconButton>
  );
}
