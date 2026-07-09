import { Popover } from "@base-ui-components/react/popover";
import {
  type APIButtonComponent,
  type APISelectMenuComponent,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";
import type { APIActionRowComponent, APIComponentInMessageActionRow } from "discord-api-types/v10";
import { useTranslation } from "@/lib/react-i18next";
import { twJoin } from "tailwind-merge";
import type { TFunction } from "@/types/i18next";
import type { CacheManager } from "@/util/cache/CacheManager";
import { cdn } from "../util/cdn";
import { Button } from "../Button";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { RoleShield } from "@/components/icons/role";
import { Twemoji } from "@/components/icons/Twemoji";
import { channelIcons } from "../utils/markdown";
import type { ResolvableAPIChannel, ResolvableAPIRole } from "../types/cache";

enum AuthorType {
  User,
  ApplicationWebhook,
  ActionableWebhook,
}

interface ResolvableAPIGuildMember {
  user: { id: string; username: string; global_name: string | null };
  nick: string | null;
}

type PreviewComponent<T extends APIComponentInMessageActionRow> = React.FC<{
  data: T;
  onClick?: React.ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  authorType?: AuthorType;
  cache?: CacheManager;
  t?: TFunction;
}>;

export const PreviewButton: PreviewComponent<APIButtonComponent> = ({
  data,
  onClick,
  authorType,
}) => {
  const nonSendable = authorType
    ? authorType < AuthorType.ApplicationWebhook
    : undefined;

  const button = (
    <Button
      discordstyle={data.style}
      emoji={data.style !== ButtonStyle.Premium ? (data as any).emoji : undefined}
      disabled={data.disabled ?? false}
      className={twJoin("!text-sm", nonSendable ? "hidden" : undefined)}
      onClick={onClick}
    >
      {data.style !== ButtonStyle.Premium ? data.label : `SKU ${data.sku_id}`}
    </Button>
  );
  return data.style === ButtonStyle.Link && data.url !== "" ? (
    <a href={data.url} target="_blank" rel="noreferrer" className="contents">
      {button}
    </a>
  ) : (
    button
  );
};

const PreviewSelectOption: React.FC<{
  label: string;
  description?: string;
  icon?: React.ReactNode;
}> = ({ label, description, icon }) => {
  return (
    <div className="flex items-center gap-2 last:rounded-b-lg hover:bg-[#F2F2F3] hover:dark:bg-[#43444B] w-full p-2 cursor-pointer">
      {icon}
      <div className="truncate text-sm font-medium">
        <p className="truncate leading-[18px]">{label}</p>
        {description && (
          <p className="truncate text-[#4e5058] dark:text-[#b5bac1] leading-[18px]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

const PreviewMemberSelectOption: React.FC<{
  member: ResolvableAPIGuildMember;
}> = ({ member }) => (
  <PreviewSelectOption
    label={member.nick ?? member.user.global_name ?? member.user.username}
    icon={
      <div className="size-[22px] shrink-0 rounded-full bg-zinc-600 flex items-center justify-center text-[10px] text-white">
        {(member.nick ?? member.user.username)[0]?.toUpperCase()}
      </div>
    }
  />
);

const PreviewRoleSelectOption: React.FC<{
  role: ResolvableAPIRole;
}> = ({ role }) => (
  <PreviewSelectOption
    label={role.name}
    icon={
      <RoleShield
        style={{ color: `#${role.color.toString(16).padStart(6, "0") === "000000" ? "9ca9b4" : role.color.toString(16).padStart(6, "0")}` }}
        className="mr-2"
      />
    }
  />
);

const PreviewChannelSelectOption: React.FC<{
  channel: ResolvableAPIChannel;
}> = ({ channel }) => (
  <PreviewSelectOption
    label={channel.name ?? ""}
    icon={channelIcons[channel.type as unknown as keyof typeof channelIcons]?.({ className: "mr-2" })}
  />
);

export const PreviewSelect: PreviewComponent<APISelectMenuComponent> = ({
  data,
  onClick,
  authorType,
  cache,
  t,
}) => {
  const shouldLeftPad =
    "options" in data && data.options.filter((o) => o.emoji).length !== 0;
  const nonSendable = authorType
    ? authorType < AuthorType.ActionableWebhook
    : undefined;

  return (
    <Popover.Root>
      <Popover.Trigger
        disabled={data.disabled}
        onClick={(e) => {
          if (onClick) {
            (e as any).preventBaseUIHandler?.();
            onClick(e);
          }
        }}
        render={
          <button
            type="button"
            data-type={data.type}
            data-custom-id={(data as any).custom_id}
            className={twJoin(
              "group/trigger",
              "max-w-[400px] mr-4 box-border items-center gap-x-2",
              "rounded-lg p-2 text-left bg-[#ebebeb] dark:bg-[#1e1f22] border border-black/[0.08] dark:border-transparent hover:border-[#c4c9ce] dark:hover:border-[#020202] transition-[border,_opacity] duration-200 font-medium cursor-pointer grid grid-cols-[1fr_auto] items-center w-full disabled:opacity-60 disabled:cursor-not-allowed",
              nonSendable ? "hidden" : undefined,
            )}
          />
        }
      >
        <span className="truncate text-[#5c5e66] dark:text-[#949ba4] leading-none">
          {data.placeholder ?? (t ? t("defaultPlaceholder") : "Select an option")}
        </span>
        <CoolIcon
          icon="Chevron_Down"
          className="group-data-[popup-open]/trigger:rotate-180"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} side="bottom" className="z-[35]">
          <Popover.Popup
            className={twJoin(
              "box-border rounded-lg w-[--anchor-width] overflow-y-auto max-h-64",
              "bg-white dark:bg-[#3C3D44] border border-[#e3e5e8] dark:border-[#1e1f22]",
            )}
          >
            {data.type === ComponentType.StringSelect ? (
              data.options.map((option, oi) => (
                <PreviewSelectOption
                  key={`preview-select-option-${oi}-${option.value}`}
                  label={option.label}
                  description={option.description}
                  icon={
                    option.emoji?.id ? (
                      <img
                        src={cdn.emoji(option.emoji.id)}
                        className="w-[22px] h-[22px] shrink-0 object-contain"
                        alt={option.emoji.name}
                      />
                    ) : option.emoji?.name ? (
                      <Twemoji
                        emoji={option.emoji.name}
                        className="w-[22px] h-[22px] shrink-0 align-middle"
                      />
                    ) : shouldLeftPad ? (
                      <div className="w-[22px] shrink-0" />
                    ) : undefined
                  }
                />
              ))
            ) : data.type === ComponentType.UserSelect && cache ? (
              (cache as any).member?.getAll?.()?.map?.((member: ResolvableAPIGuildMember) => (
                <PreviewMemberSelectOption
                  key={`preview-select-${data.type}-option-${member.user.id}`}
                  member={member}
                />
              ))
            ) : data.type === ComponentType.RoleSelect && cache ? (
              (cache as any).role?.getAll?.()?.map?.((role: ResolvableAPIRole) => (
                <PreviewRoleSelectOption
                  key={`preview-select-${data.type}-option-${role.id}`}
                  role={role}
                />
              ))
            ) : data.type === ComponentType.MentionableSelect && cache ? (
              <>
                {(cache as any).role?.getAll?.()?.map?.((role: ResolvableAPIRole) => (
                  <PreviewRoleSelectOption
                    key={`preview-select-${data.type}-option-${role.id}-role`}
                    role={role}
                  />
                ))}
                {(cache as any).member?.getAll?.()?.map?.((member: ResolvableAPIGuildMember) => (
                  <PreviewMemberSelectOption
                    key={`preview-select-${data.type}-option-${member.user.id}-user`}
                    member={member}
                  />
                ))}
              </>
            ) : data.type === ComponentType.ChannelSelect && cache ? (
              (cache as any).channel?.getAll?.()?.map?.((channel: ResolvableAPIChannel) => (
                <PreviewChannelSelectOption
                  key={`preview-select-${data.type}-option-${channel.id}`}
                  channel={channel}
                />
              ))
            ) : (
              <div className="p-3 text-xs text-zinc-500 text-center">
                {data.placeholder ?? "Select..."}
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

export const GenericPreviewComponentInActionRow: PreviewComponent<
  APIComponentInMessageActionRow
> = (props) => {
  switch (props.data.type) {
    case ComponentType.Button:
      return <PreviewButton {...props} data={props.data as APIButtonComponent} />;
    case ComponentType.StringSelect:
    case ComponentType.UserSelect:
    case ComponentType.RoleSelect:
    case ComponentType.MentionableSelect:
    case ComponentType.ChannelSelect:
      return <PreviewSelect {...props} data={props.data as APISelectMenuComponent} />;
    default:
      return <></>;
  }
};

export function PreviewActionRow(
  props:
    | { component: APIActionRowComponent<APIComponentInMessageActionRow>; authorType?: AuthorType; cache?: CacheManager }
    | { components: APIComponentInMessageActionRow[] },
) {
  const row = "component" in props ? props.component : { type: 1 as const, components: props.components };
  const resolved = row as APIActionRowComponent<APIComponentInMessageActionRow>;
  const authorType = "authorType" in props ? props.authorType : undefined;
  const cache = "cache" in props ? props.cache : undefined;
  const { t } = useTranslation();
  const isAllLinkButtons = !resolved.components
    .map((c) => c.type === ComponentType.Button && c.style === ButtonStyle.Link)
    .includes(false);

  return (
    <div className="flex flex-wrap gap-2">
      {resolved.components.map((component, ci) => (
        <div key={`action-row-component-${ci}`} className="contents">
          <GenericPreviewComponentInActionRow
            data={component}
            authorType={
              authorType === undefined ||
              authorType < AuthorType.ApplicationWebhook
                ? isAllLinkButtons
                  ? AuthorType.ApplicationWebhook
                  : undefined
                : authorType
            }
            cache={cache}
            t={t}
          />
        </div>
      ))}
    </div>
  );
}
