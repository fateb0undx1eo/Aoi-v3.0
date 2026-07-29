import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Switch } from "@/components/ui/switch";
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

  const layoutModules = modules as Array<{ name: string; display_name?: string; enabled?: boolean }>;

  async function handleModuleToggle(moduleName: string, enabled: boolean) {
    saveModule.mutate({ moduleName, body: { enabled } });
  }

  async function handleCommandToggle(moduleName: string, commandName: string, enabled: boolean) {
    saveCommand.mutate({ moduleName, commandName, enabled });
  }

  const isMutating =
    saveModule.isPending ||
    saveCommand.isPending;

  return (
    <DashboardLayout guildId={gid ?? ""} guildName={guild?.name || "Guild"} heading="Module & Command Toggles" modules={layoutModules}>
      <div className="space-y-8">
        <p className="text-sm text-muted-foreground">
          Enable or disable modules and individual commands. Disabling a module turns off all its commands and background features.
        </p>

        {commandsLoading && (
          <div className="rounded-xl bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
            Loading modules...
          </div>
        )}

        {!commandsLoading && modulesWithCommands.length === 0 && (
          <div className="rounded-xl bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
            No modules found for this guild.
          </div>
        )}

        {modulesWithCommands.map((mod) => {
          const moduleEnabled = mod.enabled;

          return (
            <section key={mod.name} className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-secondary/30 px-5 py-4 transition-colors hover:bg-secondary/50">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-foreground">{mod.display_name || mod.name}</h2>
                  {mod.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground/80">{mod.description}</p>
                  )}
                </div>
                <Switch
                  checked={moduleEnabled}
                  disabled={isMutating}
                  onCheckedChange={(checked) => handleModuleToggle(mod.name, checked)}
                />
              </div>

              <div className="ml-5 space-y-1 border-l-2 border-secondary pl-4">
                {mod.commands.length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No slash commands in this module.</p>
                )}
                {mod.commands.map((cmd) => (
                  <div
                    key={cmd.name}
                    className="flex items-center justify-between rounded-lg px-4 py-2.5 transition-colors hover:bg-secondary/20"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground">/{cmd.name}</span>
                      {cmd.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">{cmd.description}</p>
                      )}
                    </div>
                    <Switch
                      checked={cmd.enabled}
                      disabled={!moduleEnabled || isMutating}
                      onCheckedChange={(checked) => handleCommandToggle(mod.name, cmd.name, checked)}
                      className={!moduleEnabled ? "opacity-40" : ""}
                    />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
