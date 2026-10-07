import { ArrowDown, ChevronDown, LockKeyhole } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { useAuth } from "../../../../context/AuthContext";
import { useNotifications } from "../../../../context/NotificationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from "../../ui/sidebar";
import { navSections, utilityItems } from "../../data";
import { cn } from "../../lib/utils";

export function DashboardSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const isAt = (to) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  const sections =
    user?.role === "SUPER_ADMIN"
      ? [
          ...navSections,
          {
            title: "Admin",
            items: [
              { label: "Admin Panel", icon: LockKeyhole, to: "/admin" },
              { label: "Usage", icon: ArrowDown, to: "/usage" },
            ],
          },
        ]
      : navSections;

  return (
    <Sidebar collapsible="icon" className="overflow-hidden border-r">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              asChild
              size="lg"
              className="h-11 px-2 group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:p-0"
            >
              <Link to="/">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-450 to-brand-800 rounded-chip flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white [--icon-size:18px]" style={{ fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
                </div>
                <span className="text-lg font-medium">AI Caller Pro</span>
              </Link>
            </SidebarMenuButton>
            <SidebarTrigger className=" " />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-4 p-3">
        {sections.map((section) => (
          <SidebarGroup key={section.title} className="p-0">
            <SidebarGroupLabel className="h-8 px-1 text-sm">
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {section.items.map((item) => {
                  const active = isAt(item.to);
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "h-9 gap-3 rounded-lg px-3 text-sm font-medium",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        <Link to={item.to}>
                          <item.icon
                            className={cn(
                              "size-4",
                              active ? "text-primary" : "",
                            )}
                          />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarSeparator />

      <SidebarFooter className="gap-3 px-3 pb-3">
        <SidebarMenu className="gap-1">
          {utilityItems.map((item) => {
            const showBadge = item.label === "Notifications" && unreadCount > 0;
            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.label}
                  className="text-muted-foreground h-9 gap-3 rounded-lg px-3 text-sm"
                >
                  <Link to={item.to}>
                    <span className="relative inline-flex">
                      <item.icon className="size-4" />
                      {showBadge && (
                        <span className="bg-gradient-to-br from-brand-450 to-brand-800 text-primary-foreground absolute -top-1.5 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold leading-none">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="Connected account"
                  className="flex h-11 items-center gap-3 rounded-md group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                >
                  <Avatar className="size-6 shrink-0">
                    {user?.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                    <AvatarFallback className="bg-gradient-to-br from-brand-450 to-brand-800 text-primary-foreground text-xs font-semibold">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 overflow-hidden text-left text-sm font-medium text-ellipsis whitespace-nowrap group-data-[collapsible=icon]:hidden">
                    {user?.name || "User"}
                  </span>
                  <ChevronDown className="text-muted-foreground size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                align="end"
                side="right"
                sideOffset={16}
              >
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
