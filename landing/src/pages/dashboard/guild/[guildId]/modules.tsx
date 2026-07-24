import { useState } from "react";
import { useRouter } from "next/router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useGuildOverview, useModuleCommands, useSaveModule, useSaveModuleCommand, type ParsedModuleRow, type ModuleWithCommands } from "@/lib/api";

export default function ModulesPage() {
  const router = useRouter();
  const { guildId } = router.query;
  const gid = typeof guildId === "string" ? guildId : undefined;

  const { data: overviewData } = useGuildOverview(gid);
  const { data: commandsData, isLoading: commandsLoading } = useModuleCommands(gid);
  const saveModule = useSaveModule(gid);
  const saveCommand = useSaveModuleCommand(gid);

  const modules = (overviewData?.modules ?? []) as ParsedModuleRow[];
  const guild = overviewData?.guild ?? null;
  const modulesWithCommands = (commandsData?.modules ?? []) as ModuleWithCommands[];

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const layoutModules = modules as Array<{ name: string; display_name?: string; enabled?: boolean }>;

  function toggleExpanded(name: string) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  async function handleModuleToggle(moduleName: string, enabled: boolean) {
    const key = `mod:${moduleName}`;
    setToggling((prev) => ({ ...prev, [key]: true }));
    try {
      await saveModule.mutateAsync({ moduleName, body: { enabled } });
    } finally {
      setToggling((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function handleCommandToggle(moduleName: string, commandName: string, enabled: boolean) {
    const key = `cmd:${commandName}`;
    setToggling((prev) => ({ ...prev, [key]: true }));
    try {
      await saveCommand.mutateAsync({ moduleName, commandName, enabled });
    } finally {
      setToggling((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <DashboardLayout guildId={gid ?? ""} guildName={guild?.name || "Guild"} heading="Module & Command Toggles" modules={layoutModules}>
      <div className="space-y-4">
        <p className="text-sm text-foreground/70">
          Enable or disable modules and individual commands. Disabling a module turns off all its commands and background features.
        </p>

        {commandsLoading && (
          <div className="rounded-2xl border border-border/70 bg-card/70 p-8 text-center text-sm text-muted-foreground">
            Loading modules...
          </div>
        )}

        {!commandsLoading && modulesWithCommands.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-card/70 p-8 text-center text-sm text-muted-foreground">
            No modules found for this guild.
          </div>
        )}

        {modulesWithCommands.map((mod) => {
          const isExpanded = expanded[mod.name];
          const moduleEnabled = mod.enabled;
          const toggleKey = `mod:${mod.name}`;
          const isLoading = toggling[toggleKey];

          return (
            <section
              key={mod.name}
              className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-[0_20px_46px_-32px_hsl(var(--foreground)/0.45)]"
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleExpanded(mod.name)}
                  className="flex items-center gap-2 text-left"
                >
                  <div className="inline-flex rounded-xl border border-border/70 bg-background/60 p-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">{mod.display_name || mod.name}</h2>
                    {mod.description && (
                      <p className="text-xs text-foreground/60">{mod.description}</p>
                    )}
                  </div>
                </button>

                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={moduleEnabled}
                    disabled={isLoading}
                    onChange={(e) => handleModuleToggle(mod.name, e.target.checked)}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-card after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                </label>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-2 border-t border-border/70 pt-4">
                  {mod.commands.length === 0 && (
                    <p className="text-xs text-muted-foreground">No slash commands in this module.</p>
                  )}
                  {mod.commands.map((cmd) => {
                    const cmdToggleKey = `cmd:${cmd.name}`;
                    const cmdLoading = toggling[cmdToggleKey];

                    return (
                      <div
                        key={cmd.name}
                        className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-4 py-3"
                      >
                        <div>
                          <span className="text-sm font-medium">/{cmd.name}</span>
                          {cmd.description && (
                            <p className="text-xs text-foreground/60">{cmd.description}</p>
                          )}
                        </div>
                        <label
                          className={`relative inline-flex cursor-pointer items-center ${!moduleEnabled ? "opacity-40" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={cmd.enabled}
                            disabled={!moduleEnabled || cmdLoading}
                            onChange={(e) => handleCommandToggle(mod.name, cmd.name, e.target.checked)}
                          />
                          <div className="peer h-6 w-11 rounded-full bg-border after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-border after:bg-card after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
