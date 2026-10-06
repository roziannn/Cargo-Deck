import { BarChart3, BookOpen, Database, FileSearch, FileText, Home, type LucideIcon, Settings2, TestTube, Users } from "lucide-react";

// Icon mapping for backend icon strings to Lucide React icons
const iconMap: Record<string, LucideIcon> = {
  // Dashboard related
  dashboard: Home,
  iconfilename: Home, // Default fallback for backend example

  // Master data related
  master: BookOpen,
  pengujian: TestTube,
  audit: FileSearch,

  // Settings related
  settings: Settings2,
  config: Settings2,

  // Documentation related
  documentation: BookOpen,
  docs: BookOpen,

  // General fallbacks
  database: Database,
  users: Users,
  analytics: BarChart3,
  reports: FileText,
};

/**
 * Maps backend icon string to Lucide React icon component
 * @param iconString - Icon string from backend
 * @returns Lucide React icon component or default Home icon
 */
export function getIconFromString(iconString: string): LucideIcon {
  // Convert to lowercase and clean the string
  const cleanIconString = iconString.toLowerCase().trim();

  // Return mapped icon or default to Home icon
  return iconMap[cleanIconString] || Home;
}

/**
 * Get all available icons with their string keys
 * @returns Object mapping of all available icons
 */
export function getAvailableIcons(): Record<string, LucideIcon> {
  return { ...iconMap };
}
