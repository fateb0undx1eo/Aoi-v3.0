import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { BUTTON_STYLES, DISCORD_LIMITS } from "../constants";
import type { APIButtonComponent, APIComponentInActionRow, APIContainerComponent, APITopLevelComponent, APIV2ChildComponent } from "../types";
import { randomId } from "../utils/message";
import V2ChildEditor from "./V2ChildEditor";
import V2ContainerEditor from "./V2ContainerEditor";

export function totalComponentCount(components: any[]): number {
  return components.reduce((sum, c) => {
    let count = 1;
    if (Array.isArray(c.components)) {
      count += totalComponentCount(c.components);
    }
    return sum + count;
  }, 0);
}

const ICON_ADD_COMPONENT = "data:image/svg+xml,%3csvg%20width='100'%20height='100'%20viewBox='0%200%2081%2080'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20clip-path='url(%23clip0_19_2187)'%3e%3cmask%20id='mask0_19_2187'%20style='mask-type:luminance'%20maskUnits='userSpaceOnUse'%20x='0'%20y='0'%20width='81'%20height='80'%3e%3cpath%20d='M80.5%200H0.5V80H80.5V0Z'%20fill='white'/%3e%3c/mask%3e%3cg%20mask='url(%23clip0_19_2187)'%3e%3cmask%20id='mask1_19_2187'%20style='mask-type:luminance'%20maskUnits='userSpaceOnUse'%20x='-66'%20y='-68'%20width='217'%20height='217'%3e%3cpath%20d='M-65.8333%20-67.7926H150.167V148.207H-65.8333V-67.7926Z'%20fill='white'/%3e%3c/mask%3e%3cg%20mask='url(%23mask1_19_2187)'%3e%3cpath%20d='M7.62247%2025.5127C6.77872%2028.665%208.64622%2031.9027%2011.7985%2032.7487L26.0635%2036.5692C29.2135%2037.4152%2032.4557%2035.5432%2033.2995%2032.3932L37.12%2018.1282C37.9637%2014.976%2036.094%2011.7382%2032.944%2010.8922L18.679%207.06945C15.529%206.2257%2012.2867%208.09545%2011.443%2011.2477L7.62247%2025.5127Z'%20fill='%23ABABAB'/%3e%3cpath%20d='M43.8924%2026.3589C41.4759%2030.7869%2044.6822%2036.1869%2049.7267%2036.1869H67.2114C72.2559%2036.1869%2075.4599%2030.7869%2073.0457%2026.3589L64.3022%2010.3321C61.7844%205.71286%2055.1537%205.71286%2052.6337%2010.3321L43.8924%2026.3589Z'%20fill='%23ABABAB'/%3e%3cpath%20d='M20.2539%2044.3114C21.4239%2043.1211%2023.3162%2043.1211%2024.4884%2044.3114L26.9994%2046.8651C27.4787%2047.3511%2028.1042%2047.6594%2028.7747%2047.7381L32.2982%2048.1499C33.9384%2048.3411%2035.1197%2049.8509%2034.9374%2051.5271L34.5459%2055.1226C34.4717%2055.8089%2034.6269%2056.4996%2034.9847%2057.0846L36.8657%2060.1514C37.7432%2061.5801%2037.3224%2063.4634%2035.9229%2064.3634L32.9259%2066.2939C32.3544%2066.6606%2031.9202%2067.2164%2031.6952%2067.8666L30.5184%2071.2799C29.9717%2072.8684%2028.2662%2073.7076%2026.7047%2073.1541L23.3567%2071.9639C22.7177%2071.7389%2022.0224%2071.7389%2021.3857%2071.9639L18.0354%2073.1541C16.4762%2073.7076%2014.7707%2072.8684%2014.2217%2071.2799L13.0449%2067.8666C12.8222%2067.2164%2012.3879%2066.6606%2011.8164%2066.2939L8.81718%2064.3634C7.41993%2063.4634%206.99918%2061.5801%207.87443%2060.1514L9.75768%2057.0846C10.1154%2056.4996%2010.2707%2055.8089%2010.1942%2055.1226L9.80493%2051.5271C9.62268%2049.8509%2010.8017%2048.3411%2012.4442%2048.1499L15.9654%2047.7381C16.6382%2047.6594%2017.2637%2047.3511%2017.7429%2046.8651L20.2539%2044.3114Z'%20fill='%23ABABAB'/%3e%3cpath%20d='M55.5182%2070.9538C56.6882%2074.115%2061.1589%2074.115%2062.3289%2070.9538L63.8522%2066.834C64.4574%2065.1983%2065.7489%2063.9068%2067.3869%2063.3015L71.5044%2061.776C74.6657%2060.6083%2074.6657%2056.1375%2071.5044%2054.9675L67.3869%2053.442C65.7489%2052.8368%2064.4574%2051.5453%2063.8522%2049.9095L62.3289%2045.7898C61.1589%2042.6285%2056.6882%2042.6285%2055.5182%2045.7898L53.9949%2049.9095C53.3874%2051.5453%2052.0982%2052.8368%2050.4602%2053.442L46.3404%2054.9675C43.1792%2056.1375%2043.1792%2060.6083%2046.3404%2061.776L50.4602%2063.3015C52.0982%2063.9068%2053.3874%2065.1983%2053.9949%2066.834L55.5182%2070.9538Z'%20fill='%23ABABAB'/%3e%3c/g%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_19_2187'%3e%3crect%20width='80'%20height='80'%20fill='white'%20transform='translate(0.5)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e";
const ICON_BUTTON = "data:image/svg+xml,%3csvg%20width='100'%20height='100'%20viewBox='0%200%2032%2032'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M28.3448%203.53412C27.7202%202.97867%2026.8731%202.66663%2025.9898%202.66663H6.00688C5.12358%202.66663%204.27646%202.97867%203.65187%203.53412C3.02728%204.08956%202.67639%204.84291%202.67639%205.62843V26.3611C2.67639%2027.1466%203.02728%2027.8999%203.65187%2028.4554C4.27646%2029.0108%205.12358%2029.3229%206.00688%2029.3229H22.4575L21.4554%2023.045C21.3905%2022.6596%2021.3996%2022.226%2021.5416%2021.7968C21.6882%2021.3539%2021.9741%2020.931%2022.4137%2020.6345C22.8532%2020.338%2023.3525%2020.2314%2023.818%2020.2614C24.2692%2020.2905%2024.6745%2020.4445%2025.0075%2020.649L29.3203%2023.2475V5.62843C29.3203%204.84291%2028.9694%204.08956%2028.3448%203.53412ZM9.92744%2023H18.4989V21.3529H9.92744V13.1176H8.49886V21.3529C8.49886%2022.2605%209.13958%2023%209.92744%2023ZM12.7847%209H22.0704C22.8583%209%2023.499%209.73788%2023.499%2010.6471V18.0588C23.499%2018.9664%2022.8583%2019.7059%2022.0704%2019.7059H12.7847C11.9968%2019.7059%2011.3561%2018.9664%2011.3561%2018.0588V10.6471C11.3561%209.73788%2011.9968%209%2012.7847%209Z'%20fill='%23ABABAB'/%3e%3cpath%20d='M29.3203%2025.1353L24.1658%2022.0297C24.0177%2021.9378%2023.8622%2021.8846%2023.7139%2021.875C23.5841%2021.8667%2023.4636%2021.892%2023.3608%2021.9488C23.3461%2021.9569%2023.3318%2021.9657%2023.3179%2021.9751'%20fill='%23ABABAB'/%3e%3cpath%20d='M29.3203%2025.1353L30.1405%2025.6295C30.8985%2026.0887%2031.1896%2027.2073%2030.6425%2027.5763L25.7674%2030.8647C25.2203%2031.2337%2024.2887%2030.5471%2024.1504%2029.6699L23.0509%2022.7818C23.0212%2022.61%2023.0301%2022.4459%2023.0768%2022.3048C23.0768%2022.3048%2023.0767%2022.3048%2023.0768%2022.3048C23.1176%2022.1814%2023.1863%2022.079%2023.2774%2022.005'%20fill='%23ABABAB'/%3e%3c/svg%3e";
const ICON_LINK_BUTTON = "data:image/svg+xml,%3csvg%20width='100'%20height='100'%20viewBox='0%200%2029%2029'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M23.9898%200.666626C24.8731%200.666626%2025.7202%200.978672%2026.3448%201.53412C26.9694%202.08956%2027.3203%202.84291%2027.3203%203.62843V21.2475L23.0075%2018.649C22.6745%2018.4445%2022.2692%2018.2905%2021.818%2018.2614C21.3525%2018.2314%2020.8532%2018.338%2020.4137%2018.6345C19.9741%2018.931%2019.6882%2019.3539%2019.5416%2019.7968C19.3996%2020.226%2019.3905%2020.6596%2019.4554%2021.045L20.4575%2027.3229H4.00688C3.12358%2027.3229%202.27646%2027.0108%201.65187%2026.4554C1.02728%2025.8999%200.676392%2025.1466%200.676392%2024.3611V3.62843C0.676392%202.84291%201.02728%202.08956%201.65187%201.53412C2.27646%200.978672%203.12358%200.666626%204.00688%200.666626H23.9898ZM17.407%2016.3272L17.4078%2016.328C17.6118%2016.5307%2017.8876%2016.6445%2018.1752%2016.6445C18.4628%2016.6445%2018.7388%2016.5306%2018.9427%2016.3279L21.1816%2014.0979L21.1848%2014.0945C22.1823%2013.054%2022.7326%2011.6642%2022.7177%2010.2229C22.7029%208.78162%2022.1242%207.40343%2021.1056%206.38361C20.087%205.3638%2018.7095%204.78347%2017.2682%204.76696C15.8269%204.75045%2014.4365%205.29904%2013.3948%206.29526L11.1472%208.54278L11.1422%208.54864C10.9639%208.75687%2010.8707%209.02471%2010.8813%209.29865C10.8919%209.57258%2011.0054%209.83244%2011.1993%2010.0263C11.3931%2010.2201%2011.653%2010.3337%2011.9269%2010.3443C12.2009%2010.3549%2012.4687%2010.2617%2012.6769%2010.0834L12.6827%2010.0785L14.9244%207.8456C15.5571%207.2587%2016.3926%206.93977%2017.2556%206.9559C18.1196%206.97206%2018.9437%207.32289%2019.5542%207.93452C20.1648%208.54616%2020.5142%209.37085%2020.5288%2010.2349C20.5434%2011.0979%2020.223%2011.9329%2019.6349%2012.5645L17.407%2014.7924C17.2043%2014.9964%2017.0905%2015.2723%2017.0905%2015.5598C17.0905%2015.8474%2017.2043%2016.1232%2017.407%2016.3272ZM14.724%2017.4665L12.4943%2019.7052C11.8685%2020.3309%2011.0196%2020.6825%2010.1347%2020.6825C9.24968%2020.6825%208.40092%2020.331%207.77512%2019.7052C7.14932%2019.0794%206.79775%2018.2306%206.79775%2017.3456C6.79775%2016.4606%207.14932%2015.6118%207.77512%2014.986L10.0144%2012.7556C10.2172%2012.5516%2010.331%2012.2758%2010.331%2011.9882C10.331%2011.7007%2010.2172%2011.4249%2010.0146%2011.221C9.91342%2011.119%209.79303%2011.038%209.66039%2010.9828C9.52776%2010.9275%209.38549%2010.8991%209.2418%2010.8991C9.09811%2010.8991%208.95585%2010.9275%208.82321%2010.9828C8.69072%2011.038%208.57012%2011.1192%208.469%2011.221L6.23944%2013.4503L6.23393%2013.4563C5.26926%2014.5029%204.74673%2015.8819%204.77568%2017.3049C4.80463%2018.7279%205.38281%2020.0846%206.38924%2021.0911C7.39567%2022.0975%208.75235%2022.6757%2010.1754%2022.7046C11.5984%2022.7336%2012.9775%2022.2111%2014.0241%2021.2465L16.2687%2019.0107C16.4735%2018.8059%2016.5886%2018.5281%2016.5886%2018.2385C16.5886%2017.9489%2016.4735%2017.6711%2016.2687%2017.4663C16.0639%2017.2615%2015.7862%2017.1464%2015.4965%2017.1464C15.2069%2017.1464%2014.9288%2017.2617%2014.724%2017.4665ZM16.513%2013.0045L12.9587%2016.5588C12.8666%2016.6782%2012.7505%2016.7773%2012.618%2016.8495C12.4811%2016.9242%2012.3297%2016.9685%2012.1742%2016.9796C12.0186%2016.9906%2011.8625%2016.9681%2011.7164%2016.9136C11.5703%2016.8591%2011.4376%2016.7738%2011.3273%2016.6635C11.2171%2016.5532%2011.1318%2016.4206%2011.0773%2016.2745C11.0227%2016.1284%2011.0002%2015.9722%2011.0113%2015.8167C11.0223%2015.6611%2011.0667%2015.5098%2011.1413%2015.3729C11.2136%2015.2403%2011.3126%2015.1243%2011.432%2015.0321L14.9864%2011.4778L14.9977%2011.4693C15.2073%2011.3121%2015.4666%2011.2358%2015.728%2011.2543C15.9893%2011.2729%2016.2352%2011.3851%2016.4205%2011.5704C16.6057%2011.7557%2016.718%2012.0015%2016.7365%2012.2629C16.7551%2012.5242%2016.6788%2012.7835%2016.5216%2012.9931L16.513%2013.0045Z'%20fill='%23ABABAB'/%3e%3cpath%20d='M22.1504%2027.6699C22.2887%2028.5471%2023.2203%2029.2337%2023.7674%2028.8647L28.6425%2025.5763C29.1896%2025.2073%2028.8985%2024.0887%2028.1405%2023.6295L22.1658%2020.0298C22.0177%2019.9379%2021.8622%2019.8846%2021.7139%2019.8751C21.5656%2019.8655%2021.4293%2019.8999%2021.3179%2019.9751C21.2064%2020.0503%2021.1234%2020.1637%2021.0768%2020.3048C21.0301%2020.4459%2021.0212%2020.61%2021.0509%2020.7818L22.1504%2027.6699Z'%20fill='%23ABABAB'/%3e%3c/svg%3e";
const ICON_SELECT_MENU = "data:image/svg+xml,%3csvg%20width='100'%20height='100'%20viewBox='0%200%2032%2032'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M25.9898%202.66663C26.8731%202.66663%2027.7202%202.97867%2028.3448%203.53412C28.9694%204.08956%2029.3203%204.84291%2029.3203%205.62843V23.2475L25.0075%2020.649C24.6745%2020.4445%2024.2692%2020.2905%2023.818%2020.2614C23.3525%2020.2314%2022.8532%2020.338%2022.4137%2020.6345C21.9741%2020.931%2021.6882%2021.3539%2021.5416%2021.7968C21.3996%2022.226%2021.3905%2022.6596%2021.4554%2023.045L22.4575%2029.3229H6.00688C5.12358%2029.3229%204.27646%2029.0108%203.65187%2028.4554C3.02728%2027.8999%202.67639%2027.1466%202.67639%2026.3611V5.62843C2.67639%204.84291%203.02728%204.08956%203.65187%203.53412C4.27646%202.97867%205.12358%202.66663%206.00688%202.66663H25.9898ZM6.77494%208.88615C6.77494%209.73802%207.47192%2010.435%208.32379%2010.435H20.7146C21.1254%2010.435%2021.5193%2010.2718%2021.8098%209.98135C22.1002%209.69089%2022.2634%209.29693%2022.2634%208.88615L22.2634%208.31545C22.2634%207.90467%2022.1002%207.51071%2021.8097%207.22025C21.5193%206.92978%2021.1253%206.7666%2020.7145%206.7666H8.32375C7.91297%206.7666%207.51901%206.92978%207.22855%207.22025C6.93808%207.51071%206.7749%207.90467%206.7749%208.31545L6.77494%208.88615ZM8.32379%2016.1652C7.47192%2016.1652%206.77494%2015.4682%206.77494%2014.6163L6.7749%2014.0456C6.7749%2013.6348%206.93808%2013.2409%207.22855%2012.9504C7.51902%2012.6599%207.91297%2012.4968%208.32375%2012.4968H20.7145C21.1253%2012.4968%2021.5193%2012.6599%2021.8097%2012.9504C22.1002%2013.2409%2022.2634%2013.6348%2022.2634%2014.0456L22.2634%2014.6163C22.2634%2015.0271%2022.1002%2015.421%2021.8098%2015.7115C21.5193%2016.002%2021.1254%2016.1652%2020.7146%2016.1652H8.32379ZM6.77494%2020.3466C6.77494%2021.1985%207.47192%2021.8955%208.32379%2021.8955H15.8594C16.2702%2021.8955%2016.6642%2021.7323%2016.9546%2021.4418C17.2451%2021.1513%2017.4083%2020.7574%2017.4083%2020.3466L17.4083%2019.7759C17.4083%2019.3651%2017.2451%2018.9712%2016.9546%2018.6807C16.6641%2018.3902%2016.2702%2018.2271%2015.8594%2018.2271H8.32375C7.91297%2018.2271%207.51902%2018.3902%207.22855%2018.6807C6.93808%2018.9712%206.7749%2019.3651%206.7749%2019.7759L6.77494%2020.3466Z'%20fill='%23ABABAB'/%3e%3cpath%20d='M23.0509%2022.7818C23.0212%2022.61%2023.0301%2022.4459%2023.0768%2022.3048C23.0768%2022.3048%2023.0767%2022.3048%2023.0768%2022.3048C23.1234%2022.1637%2023.2064%2022.0503%2023.3178%2021.9751C23.3179%2021.9751%2023.3178%2021.9751%2023.3178%2021.9751C23.3438%2021.9576%2023.3712%2021.9422%2023.3998%2021.9291C23.4936%2021.8862%2023.6002%2021.8677%2023.7139%2021.875C23.8622%2021.8846%2024.0177%2021.9378%2024.1658%2022.0297L30.1405%2025.6295C30.8985%2026.0887%2031.1896%2027.2073%2030.6425%2027.5763L25.7674%2030.8647C25.2203%2031.2337%2024.2887%2030.5471%2024.1504%2029.6699L23.0509%2022.7818Z'%20fill='%23ABABAB'/%3e%3c/svg%3e";

const SELECT_MENU_OPTIONS = [
  { type: 3, label: "Select Menu" },
  { type: 5, label: "User Select" },
  { type: 6, label: "Role Select" },
  { type: 7, label: "User & Role Select" },
  { type: 8, label: "Channel Select" },
];

function AddComponentPopover({ ri, hasSelect, hasButton, row, onAddButton, onAddSelect }: {
  ri: number; hasSelect: boolean; hasButton: boolean; row: APITopLevelComponent & { type: 1 };
  onAddButton: (ri: number, style: number) => void;
  onAddSelect: (ri: number, selType: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "select">("main");
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuW = 160;
      let left = r.left + r.width / 2 - menuW / 2;
      // Open upward if button is in bottom half of screen
      const buttonCenterY = r.top + r.height / 2;
      if (buttonCenterY > window.innerHeight / 2) {
        let top = r.top - 1;
        if (top < 1) top = r.bottom + 1;
        if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 8;
        if (left < 8) left = 8;
        setMenuPos({ top, left });
      } else {
        let top = r.bottom + 1;
        if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 8;
        if (left < 8) left = 8;
        if (top + 200 > window.innerHeight) top = r.top - 1;
        setMenuPos({ top, left });
      }
    }
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false); setView("main");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const canAddButton = !hasSelect && row.components.length < DISCORD_LIMITS.V1_COMPONENTS_PER_ROW;
  const canAddSelect = !hasButton && row.components.length === 0;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button ref={btnRef} type="button" onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-full h-full min-h-[28px] min-w-[28px] rounded bg-transparent text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
        style={{ padding: 0 }}>
        <img src={ICON_ADD_COMPONENT} alt="" style={{ width: 20, height: 20 }} />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: "fixed", zIndex: 99999, top: menuPos.top, left: menuPos.left, width: 160, borderRadius: 8, border: "1px solid #1a1a1a", backgroundColor: "#111", padding: 4, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          {view === "main" ? (
            <>
              <button type="button" disabled={!canAddButton}
                onClick={() => { onAddButton(ri, 1); setOpen(false); setView("main"); }}
                className="w-full text-left px-2.5 py-1.5 rounded text-[11px] text-zinc-300 hover:bg-[#1A1A1A] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2">
                <img src={ICON_BUTTON} alt="" className="w-3.5 h-3.5" />
                Button
              </button>
              <button type="button" disabled={!canAddButton}
                onClick={() => { onAddButton(ri, 5); setOpen(false); setView("main"); }}
                className="w-full text-left px-2.5 py-1.5 rounded text-[11px] text-zinc-300 hover:bg-[#1A1A1A] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2">
                <img src={ICON_LINK_BUTTON} alt="" className="w-3.5 h-3.5" />
                Link Button
              </button>
              {canAddSelect && (
                <button type="button"
                  onClick={() => setView("select")}
                  className="w-full text-left px-2.5 py-1.5 rounded text-[11px] text-zinc-300 hover:bg-[#1A1A1A] cursor-pointer flex items-center gap-2">
                  <img src={ICON_SELECT_MENU} alt="" className="w-3.5 h-3.5" />
                  Select Menu
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" onClick={() => setView("main")}
                className="w-full text-left px-2.5 py-1 rounded text-[10px] text-zinc-500 hover:text-zinc-300 cursor-pointer">
                ← Back
              </button>
              {SELECT_MENU_OPTIONS.map((opt) => (
                <button key={opt.type} type="button"
                  onClick={() => { onAddSelect(ri, opt.type); setOpen(false); setView("main"); }}
                  className="w-full text-left px-2.5 py-1.5 rounded text-[11px] text-zinc-300 hover:bg-[#1A1A1A] cursor-pointer">
                  {opt.label}
                </button>
              ))}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

function reIdComponent(comp: any) {
  if (comp.type === 2 && comp.style !== 5) comp.custom_id = `btn_${randomId()}`;
  if (comp.type >= 3 && comp.type <= 8) comp.custom_id = `sel_${randomId()}`;
  if (comp.components) comp.components.forEach(reIdComponent);
}

export default function ComponentEditorForMessage({ components, onChange, onEditComponent, isV2, onAddAttachment, onAttachmentError }: {
  components: APITopLevelComponent[];
  onChange: (c: APITopLevelComponent[]) => void;
  onEditComponent: (comp: APIComponentInActionRow, ri: number, ci: number, e: React.MouseEvent<HTMLButtonElement>) => void;
  isV2?: boolean;
  onAddAttachment?: (file: File) => Promise<string>;
  onAttachmentError?: (message: string) => void;
}) {
  // ── V1 helpers ──────────────────────────────────────────────────
  const addRow = () => {
    if (components.length >= DISCORD_LIMITS.V1_ROWS) return;
    onChange([...components, { type: 1, components: [] }]);
  };
  const removeTop = (ri: number) => onChange(components.filter((_, i) => i !== ri));
  const addButton = (ri: number, style: number = 1) => {
    onChange(components.map((r, i) => {
      if (i !== ri || r.type !== 1) return r;
      if (r.components.length >= DISCORD_LIMITS.V1_COMPONENTS_PER_ROW) return r;
      const base = { type: 2 as const, style: style as 1|2|3|4|5|6, label: "Button", disabled: false };
      const button: APIButtonComponent = style === 5
        ? { ...base, url: "https://example.com" }
        : { ...base, custom_id: `btn_${randomId()}` };
      return { ...r, components: [...r.components, button] };
    }));
  };
  const addSelectToRow = (ri: number, selType: number) => {
    onChange(components.map((r, i) => {
      if (i !== ri || r.type !== 1) return r;
      if (r.components.length > 0) return r;
      const sel: any = selType === 3
        ? { type: 3, custom_id: `sel_${randomId()}`, placeholder: "Choose", options: [] }
        : { type: selType, custom_id: `sel_${randomId()}`, placeholder: "Select..." };
      return { ...r, components: [sel] };
    }));
  };
  const removeComp = (ri: number, ci: number) => {
    onChange(components.map((r, i) => i === ri && r.type === 1 ? { ...r, components: r.components.filter((_, j) => j !== ci) } : r));
  };
  const duplicate = (ri: number) => {
    const row = components[ri];
    if (!row) return;
    const cloned = JSON.parse(JSON.stringify(row));
    if (cloned.type === 1) reIdComponent(cloned);
    if (cloned.type === 17) cloned.components?.forEach(reIdComponent);
    const next = [...components];
    next.splice(ri + 1, 0, cloned);
    onChange(next);
  };

  // ── V2 helpers ──────────────────────────────────────────────────
  const addV2Bare = (itemType: APIV2ChildComponent["type"]) => {
    if (totalComponentCount(components) >= DISCORD_LIMITS.V2_TOTAL_COMPONENTS) return;
    const item: APIV2ChildComponent = itemType === 10 ? { type: 10, content: "" }
      : itemType === 12 ? { type: 12, items: [{ media: { url: "" } }] }
      : itemType === 13 ? { type: 13, file: { url: "" } }
      : itemType === 14 ? { type: 14, spacing: 1 }
      : itemType === 9 ? { type: 9, components: [{ type: 10, content: "" }] }
      : { type: 1, components: [] };
    onChange([...components, item]);
  };
  const addV2Container = () => {
    if (totalComponentCount(components) >= DISCORD_LIMITS.V2_TOTAL_COMPONENTS) return;
    onChange([...components, { type: 17, components: [] }]);
  };
  const updateContainer = (ri: number, updated: APIContainerComponent) => {
    onChange(components.map((r, i) => i === ri ? updated : r));
  };
  const updateBare = (ri: number, updated: APIV2ChildComponent) => {
    onChange(components.map((r, i) => i === ri ? updated : r));
  };
  const moveComponent = (ri: number, dir: "up" | "down") => {
    const next = [...components];
    const swap = dir === "up" ? ri - 1 : ri + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[ri]!, next[swap]!] = [next[swap]!, next[ri]!];
    onChange(next);
  };

  const v2BareLabels: { type: APIV2ChildComponent["type"]; label: string }[] = [
    { type: 10, label: "Text" },
    { type: 14, label: "Divider" },
    { type: 12, label: "Media" },
    { type: 13, label: "File" },
    { type: 9, label: "Section" },
    { type: 1, label: "Row" },
  ];

const total = totalComponentCount(components);

  // ── V1 row: detect contents ──────────────────────────────────────
  const BURGUNDY = "#8B1538";

  const addBtnClass = "flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-300 cursor-pointer";

  return (
    <div className="flex flex-col gap-2">
      {/* Header + V2 add buttons */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">
          {isV2 ? `Components (${total}/${DISCORD_LIMITS.V2_TOTAL_COMPONENTS})` : `Action Rows (${components.length}/${DISCORD_LIMITS.V1_ROWS})`}
        </span>
        {isV2 && (
          <div className="flex gap-1 flex-wrap">
            {v2BareLabels.map(({ type, label }) => (
              <button key={type} type="button" onClick={() => addV2Bare(type)}
                className={addBtnClass}>
                <CoolIcon icon="Add_Plus" size={16} />
              </button>
            ))}
            <button type="button" onClick={addV2Container}
              className="flex items-center justify-center w-7 h-7 rounded text-purple-400 hover:text-purple-300 cursor-pointer">
              <CoolIcon icon="Add_Plus" size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Component list */}
      <div className="space-y-1">
        {components.map((row, ri) => {
          // V1 Action Row
          if (row.type === 1) {
            const isEmpty = row.components.length === 0;
            return (
              <div key={ri} className="rounded-lg p-2" style={{ backgroundColor: "#151515" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                    Row {ri + 1} <span className="text-zinc-700">({row.components.length}/{DISCORD_LIMITS.V1_COMPONENTS_PER_ROW})</span>
                  </span>
                  {!isEmpty && (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => duplicate(ri)}
                        className="text-zinc-600 hover:text-zinc-300 flex items-center cursor-pointer">
                        <CoolIcon icon="Copy" size={10} />
                      </button>
                      {components.length > 1 && (
                        <button type="button" onClick={() => removeTop(ri)}
                          className="text-zinc-600 hover:text-red-400 flex items-center cursor-pointer">
                          <CoolIcon icon="Close_MD" size={10} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isEmpty ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                    <AddComponentPopover ri={ri} hasSelect={false} hasButton={false} row={row} onAddButton={addButton} onAddSelect={addSelectToRow} />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {row.components.map((comp, ci) => (
                      <button key={ci} type="button" onClick={(e) => onEditComponent(comp, ri, ci, e)}
                        className="group relative flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer transition-colors"
                        style={{
                          backgroundColor: comp.type === 2
                            ? comp.style === 1 ? "rgba(139,21,56,0.2)" : comp.style === 3 ? "rgba(34,197,94,0.2)" : comp.style === 4 ? "rgba(239,68,68,0.2)" : comp.style === 5 ? "rgba(59,130,246,0.2)" : comp.style === 6 ? "rgba(234,179,8,0.2)" : "rgba(75,75,80,0.3)"
                            : "rgba(75,75,80,0.2)",
                          borderLeft: comp.type === 2
                            ? `2px solid ${comp.style === 1 ? BURGUNDY : comp.style === 3 ? "#22c55e" : comp.style === 4 ? "#ef4444" : comp.style === 5 ? "#3b82f6" : comp.style === 6 ? "#eab308" : "#4a4a50"}`
                            : "2px solid #6366f1",
                        }}>
                        {comp.type === 2 ? (
                          <span className="text-zinc-300">{comp.label || "Button"}</span>
                        ) : (
                          <span className="text-zinc-300">{["String","","User","Role","Mentionable","Channel"][comp.type - 3] || "Select"}</span>
                        )}
                        <span
                          className="h-3.5 w-3.5 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400"
                          onClick={(e) => { e.stopPropagation(); removeComp(ri, ci); }}>
                          <CoolIcon icon="Close_MD" size={8} />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // V1 row detection helpers (for non-empty rows)
          const actionRow = row as unknown as { type: 1; components: any[] };
          const hasSelect = actionRow.components.some(c => c.type !== 2);
          const hasButton = actionRow.components.some(c => c.type === 2);
          const canAddButton = !hasSelect && actionRow.components.length < DISCORD_LIMITS.V1_COMPONENTS_PER_ROW;
          const canAddSelect = !hasButton && actionRow.components.length === 0;

          // V2 Container
          if (row.type === 17) {
            return (
              <div key={ri} className="relative">
                <div
                  className="absolute left-[-14px] top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-30 hover:opacity-100 transition-opacity"
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "0.3"}>
                  <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === 0 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Up" size={10} />
                  </button>
                  <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === components.length - 1 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Down" size={10} />
                  </button>
                </div>
                <V2ContainerEditor container={row} onContainerChange={(c) => updateContainer(ri, c)} onRemove={() => removeTop(ri)} totalComponentCount={total} onAddAttachment={onAddAttachment} onAttachmentError={onAttachmentError} />
              </div>
            );
          }

          // V2 bare component
          if (row.type === 10 || row.type === 12 || row.type === 13 || row.type === 14 || row.type === 9) {
            return (
              <div key={ri} className="relative">
                <div
                  className="absolute left-[-14px] top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-30 hover:opacity-100 transition-opacity"
                  onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "0.3"}>
                  <button type="button" onClick={() => moveComponent(ri, "up")} disabled={ri === 0}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === 0 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Up" size={10} />
                  </button>
                  <button type="button" onClick={() => moveComponent(ri, "down")} disabled={ri === components.length - 1}
                    className={`flex items-center p-0 border-none bg-none cursor-pointer ${ri === components.length - 1 ? "opacity-30" : "text-zinc-500 hover:text-zinc-300"}`}>
                    <CoolIcon icon="Chevron_Down" size={10} />
                  </button>
                </div>
                <V2ChildEditor child={row} onChange={(c) => updateBare(ri, c)} onRemove={() => removeTop(ri)} onAddAttachment={onAddAttachment} onAttachmentError={onAttachmentError} />
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* V1 add row button */}
      {!isV2 && (
        <button type="button" onClick={addRow} disabled={components.length >= DISCORD_LIMITS.V1_ROWS}
          className="w-full py-1.5 text-zinc-500 hover:text-zinc-300 cursor-pointer disabled:opacity-40 flex items-center justify-center">
          <CoolIcon icon="Add_Plus" size={16} />
        </button>
      )}
    </div>
  );
}
