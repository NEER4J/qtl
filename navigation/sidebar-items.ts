import {
  LayoutDashboard,
  FileText,
  Database,
  Users,
  MessageSquare,
  Palette,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavMainItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  subItems?: NavSubItem[];
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboards",
    items: [
      {
        title: "Dashboards",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Reports",
        url: "/dashboard/reports",
        icon: FileText,
        subItems: [
          {
            title: "All Reports",
            url: "/dashboard/reports",
          },
          {
            title: "Create Report",
            url: "/dashboard/reports/create",
          },
          {
            title: "Templates",
            url: "/dashboard/reports/templates",
          },
        ],
      },
      {
        title: "Data",
        url: "/dashboard/data",
        icon: Database,
        subItems: [
          {
            title: "Connections",
            url: "/dashboard/data/connections",
          },
          {
            title: "CSV Uploads",
            url: "/dashboard/data/uploads",
          },
          {
            title: "Sync Logs",
            url: "/dashboard/data/sync-logs",
          },
        ],
      },
      {
        title: "Clients",
        url: "/dashboard/clients",
        icon: Users,
        subItems: [
          {
            title: "Client List",
            url: "/dashboard/clients",
          },
          {
            title: "Shareable Links",
            url: "/dashboard/clients/shareable-links",
          },
        ],
      },
      {
        title: "Chat",
        url: "/dashboard/chat",
        icon: MessageSquare,
      },
      {
        title: "Branding",
        url: "/dashboard/branding",
        icon: Palette,
      },
      {
        title: "Billing",
        url: "/dashboard/billing",
        icon: CreditCard,
      },
    ],
  },
];
