import { LayoutDashboard, Users, Target, CalendarCheck, Briefcase, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Contactos", url: "/crm", icon: Users }, 
  { title: "Campañas", url: "/campaigns", icon: Target },
  { title: "Oportunidades", url: "/opportunities", icon: Briefcase },
  { title: "Webinars e Emails", url: "/webinars", icon: CalendarCheck },
];

const settingsItem = { title: "Configuración", url: "/settings", icon: Settings };

export function AppSidebar() {
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <div className="mt-6 h-10 w-10 flex items-center gap-2">
              <img
                src="/favicon.png"
                className={open ? "text-xl" : ""}></img>
                {open && <span className="text-4xl font-charles">SPIMForce</span>}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-10 pl-1">
            <SidebarMenu className="space-y-1">
              {mainItems.map((item) => (

              <SidebarMenuItem key={item.title}>
                <NavLink
                  to={item.url}
                  className={({ isActive }) =>
                    `flex items-center gap-2 h-8 px-2 font-roboto text-sm rounded-md ${
                      isActive
                        ? "bg-indigo-100 text-indigo-500"
                        : "text-indigo-500 hover:bg-indigo-100 hover:text-indigo-500"
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {open && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuItem>

              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
              <SidebarMenuItem key={settingsItem.title}>
                <NavLink
                  to={settingsItem.url}
                  className={({ isActive }) =>
                    `flex items-center gap-2 mb-6 h-8 px-2 font-roboto text-sm rounded-md ${
                      isActive
                        ? "bg-indigo-100 text-gray-500"
                        : "text-gray-500 hover:bg-indigo-100 hover:text-indigo-500"
                    }`
                  }
                >
                  <settingsItem.icon className="h-5 w-5" />
                  {open && <span>{settingsItem.title}</span>}
                </NavLink>
              </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}