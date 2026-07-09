import React from "react";

export type IconFC = React.FC<React.SVGProps<SVGSVGElement>>;

export const Svg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props} />
);
