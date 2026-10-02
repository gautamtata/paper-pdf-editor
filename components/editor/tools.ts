import {
  Highlighter,
  MousePointer2,
  Pen,
  Signature,
  Square,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Tool } from "@/lib/store/editor";

export interface ToolSpec {
  tool: Tool;
  label: string;
  keys: string;
  icon: LucideIcon;
  /** Extra tooltip line, for a key that does something else in another context. */
  note?: string;
}

/** The tool order shared by the toolbar and the command palette. */
export const TOOLS: ToolSpec[] = [
  { tool: Tool.Select, label: "Select", keys: "V", icon: MousePointer2 },
  { tool: Tool.Text, label: "Text", keys: "T", icon: Type },
  { tool: Tool.Pen, label: "Pen", keys: "P", icon: Pen },
  { tool: Tool.Highlight, label: "Highlight", keys: "H", icon: Highlighter },
  {
    tool: Tool.Rect,
    label: "Rectangle",
    keys: "R",
    note: "R rotates while pages are selected",
    icon: Square,
  },
  { tool: Tool.Signature, label: "Signature", keys: "S", icon: Signature },
];

export const TOOL_TEST_IDS: Partial<Record<Tool, string>> = {
  [Tool.Signature]: "tool-signature",
};
