import { twJoin } from "tailwind-merge";
import { CoolIcon } from "@/components/icons/CoolIcon";

const severityColors = {
  blue: "bg-blurple-100 border-blurple-200 dark:bg-blurple-300 dark:border-blurple-300",
  yellow: "bg-yellow-100 border-yellow-200 dark:bg-yellow-300 dark:border-yellow-300",
  red: "bg-rose-300 border-rose-400 dark:border-rose-300",
  pink: "bg-pink-200 border-brand-pink/30",
};

const overlayColors = {
  blue: "from-blurple-100 dark:from-blurple-300",
  yellow: "from-yellow-100 dark:from-yellow-300",
  red: "from-rose-300",
  pink: "",
};

export const InfoBox: React.FC<
  React.PropsWithChildren<{
    icon?: string;
    severity?: "blue" | "yellow" | "red" | "pink";
    collapsible?: boolean;
    open?: boolean;
  }>
> = ({ icon, children, severity, collapsible, open }) => {
  const colors = severityColors[severity ?? "blue"] ?? severityColors.blue;
  const overlay = overlayColors[severity ?? "blue"] ?? overlayColors.blue;

  return (
    <div
      className={twJoin(
        "mb-4 text-sm font-regular p-2 rounded-lg border-2 dark:font-medium select-none dark:text-black",
        colors,
      )}
    >
      {collapsible ? (
        <details className="group/info-box relative" open={open}>
          <summary className="group-open/info-box:mb-2 group-open/info-box:absolute top-0 left-0 group-open/info-box:h-full h-10 group-open/info-box:opacity-0 overflow-hidden transition-[margin] relative marker:content-none marker-none cursor-pointer select-none">
            <CoolIcon
              icon="Chevron_Right"
              className="inline group-open/info-box:hidden"
            />{" "}
            {children}
            <div
              className={`absolute w-full bottom-0 left-0 h-4 bg-gradient-to-t ${overlay}`}
            />
          </summary>
          {icon && <CoolIcon icon={icon} />} {children}
        </details>
      ) : (
        <p>
          {icon && <CoolIcon icon={icon} />} {children}
        </p>
      )}
    </div>
  );
};
